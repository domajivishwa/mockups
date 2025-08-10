
// script.js - Multi-model mockups with Konva design controls and MediaPipe recolor
(async function(){
  // elements
  const galleryEl = document.getElementById('gallery');
  const uploadModels = document.getElementById('uploadModels');
  const uploadDesign = document.getElementById('uploadDesign');
  const canvas = document.getElementById('photoCanvas');
  const ctx = canvas.getContext('2d');
  const konvaContainer = document.getElementById('konvaContainer');

  const colorPicker = document.getElementById('colorPicker');
  const shirtOpacity = document.getElementById('shirtOpacity');
  const blendSelect = document.getElementById('blend');
  const blurInput = document.getElementById('blur');

  const scaleSlider = document.getElementById('scale');
  const rotateSlider = document.getElementById('rotate');
  const designOpacity = document.getElementById('designOpacity');
  const resetDesignBtn = document.getElementById('resetDesign');
  const downloadBtn = document.getElementById('downloadBtn');

  // MediaPipe init
  const selfie = new SelfieSegmentation({locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@0.1/${f}`});
  selfie.setOptions({modelSelection: 1});
  await selfie.initialize();
  const pose = new Pose({locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.1/${f}`});
  pose.setOptions({modelComplexity: 1});
  await pose.initialize();

  // Konva stage for design overlay
  let stage = new Konva.Stage({container: konvaContainer, width: canvas.clientWidth, height: canvas.clientHeight});
  let layer = new Konva.Layer();
  stage.add(layer);
  // design image node
  let designNode = null;

  // state
  let currentModelImg = null; // HTMLImageElement
  let finalMaskCanvas = null;

  // load gallery from /models/models.json
  async function loadGallery(){
    try{
      const res = await fetch('models/models.json');
      const data = await res.json();
      data.models.forEach(src => addModelThumb('models/' + src));
    }catch(e){
      console.warn('No models.json found or failed to load:', e);
    }
  }
  function addModelThumb(src, asObjectURL=false){
    const img = document.createElement('img');
    img.src = src;
    img.className = 'thumb';
    img.title = src.split('/').pop();
    img.addEventListener('click', ()=> selectModel(src));
    galleryEl.appendChild(img);
  }

  // allow user to upload multiple model images (adds to gallery in-session)
  uploadModels.addEventListener('change', (ev)=>{
    const files = Array.from(ev.target.files || []);
    files.forEach(f => {
      const url = URL.createObjectURL(f);
      addModelThumb(url, true);
    });
    // auto-select the last uploaded
    if(files.length) selectModel(URL.createObjectURL(files[files.length-1]));
    ev.target.value = '';
  });

  async function selectModel(src){
    // mark selected thumbnail
    Array.from(galleryEl.querySelectorAll('.thumb')).forEach(t => t.classList.toggle('selected', t.src === src));
    // load image
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = src; });
    currentModelImg = img;
    await processImage(img);
  }

  function fitCanvasToImage(img){
    const maxW = 1200;
    const scale = Math.min(1, maxW / img.naturalWidth);
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.style.width = '100%';
    canvas.style.height = 'auto';
    // resize Konva stage to match displayed canvas size
    stage.width(canvas.clientWidth);
    stage.height(canvas.clientHeight);
    stage.draw();
  }

  async function runSegmentationAndPose(img){
    const off = document.createElement('canvas');
    off.width = canvas.width; off.height = canvas.height;
    const octx = off.getContext('2d');
    octx.drawImage(img, 0, 0, off.width, off.height);
    const seg = await selfie.send({image: off});
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = off.width; maskCanvas.height = off.height;
    const mctx = maskCanvas.getContext('2d');
    mctx.drawImage(seg.segmentationMask, 0, 0, maskCanvas.width, maskCanvas.height);
    const poseRes = await pose.send({image: off});
    return {maskCanvas, landmarks: poseRes.poseLandmarks || null};
  }

  function buildTorsoPolygon(landmarks){
    if(!landmarks) return null;
    const idx = {LS:11, RS:12, LH:23, RH:24};
    if(!landmarks[idx.LS] || !landmarks[idx.RS] || !landmarks[idx.LH] || !landmarks[idx.RH]) return null;
    function den(pt){ return [pt.x * canvas.width, pt.y * canvas.height]; }
    const pLS = den(landmarks[idx.LS]);
    const pRS = den(landmarks[idx.RS]);
    const pLH = den(landmarks[idx.LH]);
    const pRH = den(landmarks[idx.RH]);
    return [pRS, pLS, pLH, pRH];
  }

  function intersectMaskWithPoly(maskCanvas, poly, blurAmount=6){
    const fm = document.createElement('canvas');
    fm.width = maskCanvas.width; fm.height = maskCanvas.height;
    const fctx = fm.getContext('2d');
    fctx.drawImage(maskCanvas, 0, 0);
    if(poly){
      fctx.globalCompositeOperation = 'destination-in';
      fctx.beginPath();
      fctx.moveTo(poly[0][0], poly[0][1]);
      for(let i=1;i<poly.length;i++) fctx.lineTo(poly[i][0], poly[i][1]);
      fctx.closePath();
      fctx.fill();
      fctx.globalCompositeOperation = 'source-over';
    }
    if(blurAmount>0){
      fctx.filter = `blur(${blurAmount}px)`;
      const id = fctx.getImageData(0,0,fm.width,fm.height);
      fctx.putImageData(id,0,0);
      fctx.filter = 'none';
    }
    return fm;
  }

  function applyShirtColor(img, maskCanvas){
    // draw base image
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    // create overlay with color
    const overlay = document.createElement('canvas'); overlay.width = canvas.width; overlay.height = canvas.height;
    const octx = overlay.getContext('2d');
    octx.fillStyle = colorPicker.value;
    octx.fillRect(0,0,overlay.width,overlay.height);
    octx.globalCompositeOperation = 'destination-in';
    octx.drawImage(maskCanvas, 0, 0);
    octx.globalCompositeOperation = 'source-over';
    // draw overlay onto main canvas
    ctx.globalAlpha = Number(shirtOpacity.value);
    ctx.globalCompositeOperation = blendSelect.value || 'multiply';
    ctx.drawImage(overlay,0,0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  async function processImage(img){
    fitCanvasToImage(img);
    // clear Konva layer
    layer.destroyChildren();
    layer.draw();
    // compute mask+pose
    const {maskCanvas, landmarks} = await runSegmentationAndPose(img);
    const torsoPoly = buildTorsoPolygon(landmarks);
    finalMaskCanvas = intersectMaskWithPoly(maskCanvas, torsoPoly, Number(blurInput.value));
    applyShirtColor(img, finalMaskCanvas);
    // enable Konva interactions
    enableKonvaForDesign();
  }

  // Konva design helpers
  function enableKonvaForDesign(){
    // pointer events only for Konva container
    konvaContainer.style.pointerEvents = 'auto';
    // ensure stage dimensions match displayed canvas
    stage.width(canvas.clientWidth);
    stage.height(canvas.clientHeight);
    stage.draw();
  }

  uploadDesign.addEventListener('change', (ev)=>{
    const f = ev.target.files && ev.target.files[0];
    if(!f) return;
    const url = URL.createObjectURL(f);
    const img = new window.Image();
    img.onload = ()=>{
      // create Konva image
      const kimg = new Konva.Image({image: img, x: stage.width()/2, y: stage.height()/2, offsetX: img.width/2, offsetY: img.height/2, draggable:true});
      // fit initial scale relative to stage
      const baseScale = Math.min(stage.width() / (img.width*3), stage.height() / (img.height*3), 1);
      kimg.scale({x: baseScale, y: baseScale});
      kimg.opacity(Number(designOpacity.value));
      kimg.rotate(Number(rotateSlider.value));
      designNode = kimg;
      layer.add(kimg);
      // add transformer for handles
      const tr = new Konva.Transformer({nodes:[kimg], rotateEnabled:true, enabledAnchors:['top-left','top-right','bottom-left','bottom-right']});
      layer.add(tr);
      layer.draw();
      // wire sliders to node if changed
      scaleSlider.addEventListener('input', ()=>{ if(!designNode) return; designNode.scale({x: Number(scaleSlider.value), y: Number(scaleSlider.value)}); layer.batchDraw(); });
      rotateSlider.addEventListener('input', ()=>{ if(!designNode) return; designNode.rotation(Number(rotateSlider.value)); layer.batchDraw(); });
      designOpacity.addEventListener('input', ()=>{ if(!designNode) return; designNode.opacity(Number(designOpacity.value)); layer.batchDraw(); });
      resetDesignBtn.addEventListener('click', ()=>{ if(!designNode) return; designNode.position({x: stage.width()/2, y: stage.height()/2}); designNode.rotation(0); designNode.scale({x:1,y:1}); designNode.opacity(1); scaleSlider.value=1; rotateSlider.value=0; designOpacity.value=1; layer.draw(); });
    };
    img.src = url;
    ev.target.value = '';
  });

  // wire shirt controls
  [colorPicker, shirtOpacity, blendSelect].forEach(el=> el.addEventListener('input', ()=>{ if(currentModelImg && finalMaskCanvas) applyShirtColor(currentModelImg, finalMaskCanvas); }));
  blurInput.addEventListener('input', async ()=>{ if(!currentModelImg) return; const {maskCanvas, landmarks} = await runSegmentationAndPose(currentModelImg); finalMaskCanvas = intersectMaskWithPoly(maskCanvas, buildTorsoPolygon(landmarks), Number(blurInput.value)); applyShirtColor(currentModelImg, finalMaskCanvas); });

  // export - compose base canvas + konva layer into final image
  downloadBtn.addEventListener('click', ()=>{
    if(!currentModelImg) return alert('No model selected');
    // draw base (recolored) already on canvas; now draw design layer onto a temporary canvas at same size
    const exportCanvas = document.createElement('canvas'); exportCanvas.width = canvas.width; exportCanvas.height = canvas.height;
    const ectx = exportCanvas.getContext('2d');
    // draw current canvas pixels
    ectx.drawImage(canvas, 0, 0);
    // draw Konva layer by exporting as dataURL (scale to match)
    const dataURL = stage.toDataURL({pixelRatio: 1});
    const overlayImg = new Image();
    overlayImg.onload = ()=>{
      ectx.drawImage(overlayImg, 0, 0, exportCanvas.width, exportCanvas.height);
      exportCanvas.toBlob((blob)=>{
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'tshirt-mockup.png'; a.click();
        URL.revokeObjectURL(url);
      }, 'image/png');
    };
    overlayImg.src = dataURL;
  });

  // initialize
  await loadGallery();
  // automatically select first model if present
  const first = galleryEl.querySelector('.thumb');
  if(first) first.click();

})();