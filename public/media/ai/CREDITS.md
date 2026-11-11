# Third-party assets

Assets in `public/media/ai` that were not made for VYBEVERSE. Each must keep its credit here for as long as it ships, and each is a stand-in to be replaced before public launch (docs/AI-ASSETS.md, section 6).

| File | Shown as | Source | Author | Licence |
|---|---|---|---|---|
| `3d/night-runner-qora.glb` | Night Runner Krossovka, qora (3D Showroom test model) | [MaterialsVariantsShoe](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/MaterialsVariantsShoe), Khronos glTF Sample Assets | © 2021 Shopify | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/legalcode) |

Changes: optimised by `npm run assets:import` (centred, textures converted to WebP, geometry compressed with Meshopt). The shoe's colourway is the source model's and does not match the catalogue colour.

## Made for VYBEVERSE with AI tools

No credit is required for these. They are listed so their origin and terms stay known.

| File | How it was made | Terms |
|---|---|---|
| `3d/noir-oversize-hudi-qora.glb`, `3d/noir-oversize-hudi-grafit.glb`, `3d/cut-line-futbolka-sut.glb`, `3d/blackout-bomber-qora.glb`, `3d/shadow-kargo-qora.glb` | Shape: [Tencent Hunyuan3D-2](https://huggingface.co/tencent/Hunyuan3D-2) from the product's packshot (`npm run assets:shape`), simplified to 60k triangles. Texture: each colour's packshot projected onto the faces the front camera sees, the garment's average colour elsewhere (`npm run assets:texture`). | [Tencent Hunyuan 3D 2.0 Community License](https://huggingface.co/tencent/Hunyuan3D-2/blob/main/LICENSE): Tencent claims no rights in outputs. The licence does not cover the EU, UK or South Korea, and use there is not licensed. |
| `products/noir-oversize-hudi-*.webp`, `products/cut-line-futbolka-sut-*.webp`, `products/blackout-bomber-qora-*.webp`, `products/shadow-kargo-qora-*.webp` | Packshots made by the owner with an AI image service. Stray background specks were cleared from the tee, bomber and trousers before import. | Per that service's plan. Check commercial use before launch. |
