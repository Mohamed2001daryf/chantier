import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { to, ownerName, role, siteUrl } = req.body;

    if (!to || !role) {
      return res.status(400).json({ error: 'Email et rôle requis' });
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'RESEND_API_KEY non configurée' });
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'ChantierPro <onboarding@resend.dev>',
        to: [to],
        subject: 'Invitation ChantierPro - Rejoignez le projet',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9fafb; padding: 20px; border-radius: 16px;">
            <div style="text-align: center; margin-bottom: 24px;">
              <div style="display: inline-block; background: #FF851B; color: white; font-weight: 900; font-size: 24px; width: 50px; height: 50px; line-height: 50px; border-radius: 12px;">CP</div>
              <h1 style="color: #001F3F; margin: 12px 0 0;">ChantierPro</h1>
            </div>
            <div style="background: white; border-radius: 12px; padding: 32px; border: 1px solid #e5e7eb;">
              <h2 style="color: #001F3F; margin-top: 0;">Vous êtes invité(e) !</h2>
              <p style="color: #4b5563; line-height: 1.6;">
                <strong>${ownerName || 'Le chef de projet'}</strong> vous invite à rejoindre son projet sur ChantierPro avec le rôle <strong style="color: #FF851B;">"${role}"</strong>.
              </p>
              <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 20px 0;">
                <p style="margin: 0; color: #166534; font-weight: bold;">Pour accéder au projet :</p>
                <ol style="color: #166534; margin: 8px 0 0; padding-left: 20px;">
                  <li>Allez sur <a href="${siteUrl}" style="color: #FF851B; font-weight: bold;">${siteUrl}</a></li>
                  <li>Créez un compte avec cet email : <strong>${to}</strong></li>
                  <li>Vous aurez automatiquement accès au projet</li>
                </ol>
              </div>
              <a href="${siteUrl}" style="display: inline-block; background: #FF851B; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 8px;">Accéder à ChantierPro</a>
            </div>
            <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 16px;">© ChantierPro — Gestion de chantier intelligente</p>
          </div>
        `,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Resend API error:', data);
      return res.status(500).json({ error: data?.message || 'Erreur envoi email' });
    }

    return res.status(200).json({ success: true, id: data?.id });
  } catch (err: any) {
    console.error('send-invite error:', err);
    return res.status(500).json({ error: err.message });
  }
}
