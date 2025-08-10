
# T-Shirt Mockup Editor

Static site for creating T-shirt mockups with:
- Model gallery selection
- Multiple model uploads
- Design upload (drag, rotate, scale)
- Shirt color change (AI masking can be added)
- Download final image

## Hosting on GitHub + Cloudflare Pages

1. Create a GitHub repo, push these files.
2. In Cloudflare Pages, create a new project, connect your GitHub repo.
3. Use `main` branch, root folder `/`, no build command.
4. Deploy and get your `.pages.dev` link.

To add more models, place them in `/models/` and update `models/models.json`.
