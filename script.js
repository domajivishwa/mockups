
let stage, layer, designImage, modelImage, modelGallery, shirtColorInput;
let designScale = 1, designRotation = 0, designOpacity = 1;
let selectedModelSrc = null;

document.addEventListener('DOMContentLoaded', () => {
  stage = new Konva.Stage({
    container: 'container',
    width: 600,
    height: 800
  });
  layer = new Konva.Layer();
  stage.add(layer);

  modelGallery = document.getElementById('model-gallery');
  shirtColorInput = document.getElementById('shirt-color');

  loadModelGallery();

  document.getElementById('upload-model').addEventListener('change', handleModelUpload);
  document.getElementById('upload-design').addEventListener('change', handleDesignUpload);

  document.getElementById('scale-slider').addEventListener('input', (e) => {
    designScale = parseFloat(e.target.value);
    if (designImage) designImage.scale({x: designScale, y: designScale});
    layer.batchDraw();
  });

  document.getElementById('rotation-slider').addEventListener('input', (e) => {
    designRotation = parseFloat(e.target.value);
    if (designImage) designImage.rotation(designRotation);
    layer.batchDraw();
  });

  document.getElementById('opacity-slider').addEventListener('input', (e) => {
    designOpacity = parseFloat(e.target.value);
    if (designImage) designImage.opacity(designOpacity);
    layer.batchDraw();
  });

  document.getElementById('reset-design').addEventListener('click', () => {
    if (designImage) {
      designImage.position({x: stage.width()/2, y: stage.height()/2});
      designImage.scale({x: 1, y: 1});
      designImage.rotation(0);
      layer.batchDraw();
    }
  });

  document.getElementById('download-result').addEventListener('click', downloadMockup);
});

function loadModelGallery() {
  fetch('models/models.json')
    .then(res => res.json())
    .then(models => {
      models.forEach(src => {
        const img = document.createElement('img');
        img.src = 'models/' + src;
        img.addEventListener('click', () => selectModel(img.src, img));
        modelGallery.appendChild(img);
      });
    });
}

function selectModel(src, imgElem) {
  document.querySelectorAll('#model-gallery img').forEach(el => el.classList.remove('selected'));
  imgElem.classList.add('selected');
  selectedModelSrc = src;
  Konva.Image.fromURL(src, (model) => {
    layer.destroyChildren();
    modelImage = model;
    modelImage.setAttrs({x: 0, y: 0, width: stage.width(), height: stage.height()});
    layer.add(modelImage);
    layer.draw();
  });
}

function handleModelUpload(e) {
  const files = e.target.files;
  Array.from(files).forEach(file => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = document.createElement('img');
      img.src = ev.target.result;
      img.addEventListener('click', () => selectModel(img.src, img));
      modelGallery.appendChild(img);
    };
    reader.readAsDataURL(file);
  });
}

function handleDesignUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    Konva.Image.fromURL(ev.target.result, (design) => {
      designImage = design;
      designImage.setAttrs({
        x: stage.width()/2,
        y: stage.height()/2,
        offsetX: design.width()/2,
        offsetY: design.height()/2,
        draggable: true
      });
      layer.add(designImage);
      layer.draw();
    });
  };
  reader.readAsDataURL(file);
}

function downloadMockup() {
  const dataURL = stage.toDataURL({ pixelRatio: 2 });
  const a = document.createElement('a');
  a.href = dataURL;
  a.download = 'tshirt_mockup.png';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
