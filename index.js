const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET);
const admin = require('firebase-admin');

const app = express();

const serviceAccount = JSON.parse(process.env.FIREBASE_CREDENTIALS);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

app.post('/stripeWebhook', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send('Webhook Error: ' + err.message);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const email = session.customer_details && session.customer_details.email;
    const plano = session.metadata && session.metadata.plano;
    if (email) {
      const snap = await db.collection('users')
        .where('email', '==', email).limit(1).get();
      if (!snap.empty) {
        const uid = snap.docs[0].id;
        await db.collection('users').doc(uid).update({
          plano: plano || 'mensal',
          planoAtivadoEm: new Date().toISOString(),
          stripeSessionId: session.id
        });
      }
    }
  }
  res.json({ received: true });
});

app.listen(process.env.PORT || 3000, () => console.log('Servidor rodando!'));