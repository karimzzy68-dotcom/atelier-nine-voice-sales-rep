# Atelier Nine: Voice Sales Rep

A voice-first AI sales associate ("Mara") for a demo fashion store, powered by
ElevenLabs Conversational AI. Mara talks like a real stylist, asks about the
occasion, style, size and budget, shows product cards on screen, styles the full
look, handles hesitation, and adds items to the bag. You can interrupt her
mid-sentence, just like a person.

## Run it

1. Paste your ElevenLabs API key into `.env` (`ELEVENLABS_API_KEY=...`).
2. `npm run setup-agent`: creates the agent in your ElevenLabs account and saves its ID.
3. `npm start`, then open http://localhost:5173 and click **Talk to Mara**.

## Make it yours

- **Products, store name, rep name, policies:** edit `catalog.json`, then run `npm run setup-agent` again.
- **Sales style:** edit the playbook in `lib/prompt.mjs`, then run `npm run setup-agent`.
- **Voice:** `npm run voices` lists the voices on your account. Put one in `VOICE_ID` in `.env`
  and run `npm run setup-agent`. You can also design or clone a voice in ElevenLabs and use its ID.
- **Checkout:** `open_checkout` in `public/app.js` shows a demo screen; connect Shopify or Stripe there.
