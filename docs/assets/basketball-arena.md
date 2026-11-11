# Benger basketball arena art

Original art generated for Benger with OpenAI image generation on 2026-11-10. Fictional adult athletes in plain forest-green and amber uniforms; no real player, club, sponsor or league branding is intended. This is bundled artwork, not an AI feature or a runtime service. No user photo or personal data was supplied.

The source image is an original five-row progression atlas: practice, dribbling, first game, jump shot in a full arena, layup in a brightly lit arena. Equal fifth-height panels; 1024 × 1536 pixels. The source was encoded as WebP quality 86 without changing visual content. Only the compact WebP is shipped; no network URL or image dependency is used.

Runtime crop bounds use floor(level × height / 5) through floor((level + 1) × height / 5); this covers every row without crossing into adjacent scenes. Canvas adds rounded clipping, a subtle theme tint and a small score-dependent camera crop. The score calculation and weekly history do not depend on this artwork.

Asset: `android/app/src/main/res/drawable-nodpi/basketball_arena.webp`

SHA256: `0a6af4750c2124e75191ec580887b7b7603d0360178b6b1bb80050a6c9688942`

No third-party photo, team logo, external font or stock asset is bundled. Existing Benger dependency and food-data notices are unchanged. Generated artwork may not be unique; no claim of third-party exclusivity is made.

## Shot animation background (1.0.12)

Original generated artwork, 2026-11-11: fictional player in follow-through pose, without a basketball. The ball is rendered by the application. Source image 1536 × 1024, WebP quality 86; crop and trajectory are defined in `arena-shot.json`. No personal image or real athlete was supplied.

Asset: `android/app/src/main/res/drawable-nodpi/basketball_shot.webp`

SHA256: `e10dbc96238d8c3db55a3148b1465d8f628ff1a98652d2782e04174edd5c03fe`
