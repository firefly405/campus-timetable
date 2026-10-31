import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();
process.stdout.write(
  `VAPID_PUBLIC_KEY=${keys.publicKey}\nVAPID_PRIVATE_KEY=${keys.privateKey}\nVAPID_SUBJECT=https://errand-sprint-recess.ngrok-free.dev/\n`,
);
