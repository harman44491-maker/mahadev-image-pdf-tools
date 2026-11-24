# DocX Studio - Pro Image & PDF Toolkit

Modular multi-page web application ready for **GitHub Pages**.

## Folder Structure
- `index.html` - Image Resizer (Home)
- `ai-photo.html` - AI Photo Studio (Prompt se Image + Photo Edit)
- `passport.html` — Passport Photo Maker
- `watermark.html` — Watermark Remover
- `pdf-tools.html` — PDF Tools & Security
- `pdf-editor.html` — Visual PDF Editor (Text/Img)
- `pdf-form.html` — PDF Form Filler
- `join-edit.html` — Join, Edit & Create
- `css/style.css` — Shared Stylesheet
- `js/shared.js` — Common Utilities & Font Lists
- `js/*.js` — Page-specific scripts (loads heavy libraries only on the page that needs them)

## Accounts, OTP and paid credits

The account and wallet features use Supabase Auth/Database and the existing Express API. Payments use Razorpay Checkout; Google Pay may be offered as a UPI method when enabled for the Razorpay account.

1. Create a Supabase project and run `supabase/schema.sql` in its SQL Editor.
2. Enable Phone OTP and Email OTP in Supabase Auth. Configure an SMS provider and SMTP, and set the email OTP template to display the token (`{{ .Token }}`), not only a magic link.
3. Enable Google and Facebook under Supabase Auth providers. Set their OAuth credentials and add the GitHub Pages site URL (and local development URL, if used) to Supabase's Site URL / redirect allow list.
4. Set these Express API environment variables in the backend deployment: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `SITE_ORIGINS` (comma-separated exact site origins, such as `https://harman44491-maker.github.io`). Never put the service-role or Razorpay secret in frontend code.
5. Set `window.DOCX_API_URL` in `js/auth-config.js` to the Express API's public origin. Keep the Supabase anon key public; all wallet updates and payment verification are performed by the API.
6. Configure Razorpay UPI/Google Pay methods and test payments with Razorpay test keys before enabling live keys.

Watermark removal is priced per file: ₹10 up to 3 PDF pages (images count as one page), ₹15 for 4–15 pages, and ₹20 above 15 pages. PDF Editor costs ₹10 per saved PDF. Credits are charged in paise by the API and refunded when client-side processing reports an error. Because PDF processing currently runs in the browser, this is an application-level paywall rather than tamper-proof DRM; processing and page-count verification would need to move to a trusted server to prevent a user from modifying the frontend.
