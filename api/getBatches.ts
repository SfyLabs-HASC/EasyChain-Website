// api/getBatches.ts

import type { NextApiRequest, NextApiResponse } from 'next';

// Nota: Anche se non usi Next.js per il frontend, Vercel usa questa sintassi 
// per le sue Serverless Functions. Assicurati di avere 'next' come dipendenza di sviluppo.
// Puoi installarlo con: npm install next --save-dev

// Definiamo un tipo per la risposta che ci aspettiamo da Insight
interface InsightEvent {
  id: string;
  transaction_hash: string;
  block_number: number;
  event_name: string;
  data: Record<string, any>;
  // ...altri campi se necessari
}

interface InsightResponse {
  result: InsightEvent[];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // 1. Permetti solo richieste GET
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // 2. Recupera l'indirizzo del wallet dalla query della richiesta
  const { address } = req.query;
  if (!address || typeof address !== 'string') {
    return res.status(400).json({ message: 'Address del contributor è richiesto.' });
  }

  // 3. Prepara la chiamata all'API di Thirdweb Insight
  const contractAddress = '0x2Bd72307a73cC7BE3f275a81c8eDBE775bB08F3E';
  const eventName = 'BatchInitialized';
  
  // Usiamo il modo più pulito per filtrare gli eventi per un argomento indicizzato ("contributor")
  const insightUrl = new URL(`https://polygon.insight.thirdweb.com/v1/events`);
  insightUrl.searchParams.append('contractAddress', contractAddress);
  insightUrl.searchParams.append('eventName', eventName);
  insightUrl.searchParams.append(`filters[contributor]`, address); // Filtra per l'indirizzo del wallet
  insightUrl.searchParams.append('decode', 'true'); // Chiediamo di decodificare i dati dell'evento
  insightUrl.searchParams.append('order', 'desc'); // Ordiniamo dal più recente

  // 4. Recupera la chiave segreta dalle variabili d'ambiente di Vercel
  const secretKey = process.env.THIRDWEB_SECRET_KEY;
  if (!secretKey) {
    console.error("Errore del server: La variabile d'ambiente THIRDWEB_SECRET_KEY non è impostata.");
    return res.status(500).json({ message: 'Errore di configurazione del server.' });
  }

  try {
    // 5. Esegui la chiamata sicura dal backend
    const apiResponse = await fetch(insightUrl.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-secret-key': secretKey, // Usa la chiave segreta qui
      },
    });

    // 6. Gestisci la risposta da Thirdweb
    if (!apiResponse.ok) {
      const errorBody = await apiResponse.text();
      console.error("Errore dall'API di Thirdweb Insight:", apiResponse.status, errorBody);
      return res.status(apiResponse.status).json({ message: 'Errore nel recuperare i dati da Insight.', details: errorBody });
    }

    const data: InsightResponse = await apiResponse.json();

    // 7. Invia i dati al frontend
    res.status(200).json(data.result || []);

  } catch (error) {
    console.error("Errore interno del server in /api/getBatches:", error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}
