import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";

import { ConnectButton, useActiveAccount, useReadContract, useSendTransaction } from "@thirdweb-dev/react";
import { createThirdwebClient, getContract, prepareContractCall } from "@thirdweb-dev/sdk";
import { polygon } from "@thirdweb-dev/chains";
import { inAppWallet } from "@thirdweb-dev/wallets";

import { supplyChainABI as abi } from "../abi/contractABI";

import "../App.css";

import TransactionStatusModal from "../components/TransactionStatusModal";

const client = createThirdwebClient({
  clientId: "eda8282e23ee12f17d8d1d20ef8aaa83",
});

const contract = getContract({
  client,
  chain: polygon,
  address: "0x2Bd72307a73cC7BE3f275a81c8eDBE775bB08F3E",
});

const AziendaPage = () => {
  const account = useActiveAccount();

  // Stato della pagina e dati
  const [modal, setModal] = useState<"init" | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [txResult, setTxResult] = useState<{ status: string; message: string } | null>(null);

  // Form state per nuova iscrizione
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    date: "",
    location: "",
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Info contribuente
  const { data: contributorData, isLoading: isStatusLoading, refetch: refetchContributorInfo, isError } = useReadContract({
    contract,
    method: "getContributorInfo",
    args: [account?.address || ""],
    enabled: !!account,
  });

  // Tutti i batch iscritti dall'azienda
  const [allBatches, setAllBatches] = useState<any[]>([]);
  const [filteredBatches, setFilteredBatches] = useState<any[]>([]);
  const [isLoadingBatches, setIsLoadingBatches] = useState(true);

  // Filtri tabella
  const [nameFilter, setNameFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Caricamento dati iscrizioni via Insight
  useEffect(() => {
    const fetchAllBatches = async () => {
      if (!account?.address) return;
      setIsLoadingBatches(true);
      setLoadingMessage("Caricamento iscrizioni in corso...");

      try {
        // Prepariamo l'indirizzo padded (topic1 richiede 32 byte padded)
        // L'indirizzo Ethereum è 20 byte (40 caratteri esadecimali), dobbiamo premettere 24 zeri (12 byte) per padding
        const paddedAddress = "0x" + "0".repeat(24) + account.address.toLowerCase().replace("0x", "");

        // Event signature hash (keccak256 del topic)
        // Per esempio, il topic1 sarà hash dell'evento BatchInitialized(address,uint256,string,string,string,string,string,string,bool)
        // In realtà qui usiamo semplicemente la signature così com’è per la chiamata
        const eventSignature = "BatchInitialized(address,uint256,string,string,string,string,string,string,bool)";

        // Codifichiamo il topic hash
        // ATTENZIONE: qui dovrebbe essere l'hash keccak256 dell'evento ma nel codice originale userai il nome evento come topic, da adattare se serve

        // Endpoint insight per eventi:
        const insightBaseUrl = "https://polygon.insight.thirdweb.com";

        // URL con params per filtrare per contratto e topic1 (l'indirizzo padded)
        const url = `${insightBaseUrl}/events/topics/${encodeURIComponent(eventSignature)}?contractAddress=0x2Bd72307a73cC7BE3f275a81c8eDBE775bB08F3E&topic1=${paddedAddress}`;

        const res = await fetch(url);
        const json = await res.json();

        const events = json.result || [];

        // Parsing degli eventi in formato batch
        const batches = events.map((event: any, index: number) => {
          const parsedData = JSON.parse(event.data);
          return {
            id: event.transactionHash + "-" + index,
            batchId: BigInt(parsedData[0] || "0"),
            name: parsedData[1] || "",
            description: parsedData[2] || "",
            date: parsedData[3] || "",
            location: parsedData[4] || "",
            imageIpfsHash: parsedData[5] || "",
            contributorName: parsedData[6] || "",
            isClosed: parsedData[7] || false,
          };
        });

        setAllBatches(batches);
        setFilteredBatches(batches);
      } catch (error) {
        console.error("Errore caricamento iscrizioni:", error);
        setAllBatches([]);
        setFilteredBatches([]);
      } finally {
        setIsLoadingBatches(false);
        setLoadingMessage("");
      }
    };

    fetchAllBatches();
  }, [account]);

  // Filtri applicati ai batch
  useEffect(() => {
    let filtered = allBatches;

    if (nameFilter) {
      filtered = filtered.filter((b) => b.name.toLowerCase().includes(nameFilter.toLowerCase()));
    }
    if (locationFilter) {
      filtered = filtered.filter((b) => b.location.toLowerCase().includes(locationFilter.toLowerCase()));
    }
    if (statusFilter !== "all") {
      const closed = statusFilter === "closed";
      filtered = filtered.filter((b) => b.isClosed === closed);
    }

    setFilteredBatches(filtered);
  }, [nameFilter, locationFilter, statusFilter, allBatches]);

  // Controllo stato account
  if (!account)
    return (
      <>
        <div className="container">
          <h1>Devi connettere il wallet per accedere.</h1>
          <ConnectButton />
        </div>
      </>
    );

  if (isStatusLoading)
    return (
      <>
        <div className="container">
          <h1>Caricamento dati account...</h1>
        </div>
      </>
    );

  if (isError || !contributorData)
    return (
      <>
        <div className="container">
          <h1>Errore nel caricamento dei dati utente.</h1>
        </div>
      </>
    );

  const isContributorActive = contributorData[2]; // booleano attivazione

  // Gestione form dati iscrizione
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    } else {
      setSelectedFile(null);
    }
  };

  // TODO: implementa invio transazione, caricamento IPFS ecc.

  return (
    <>
      <div className="container">
        <ConnectButton />
        {!isContributorActive ? (
          <div className="card">
            <h3>Benvenuto su Easy Chain!</h3>
            <p>Il tuo account non è ancora attivo. Compila il form di registrazione per inviare una richiesta di attivazione.</p>
          </div>
        ) : (
          <>
            {/* Dashboard header */}
            <div className="dashboard-header-card">
              <h2>{contributorData[0]}</h2>
              <p>Crediti: {contributorData[1].toString()}</p>
              <button onClick={() => setModal("init")}>Nuova Iscrizione</button>
            </div>

            {/* Tabella iscrizioni */}
            {isLoadingBatches ? (
              <p>{loadingMessage}</p>
            ) : (
              <table className="company-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Nome</th>
                    <th>Data</th>
                    <th>Luogo</th>
                    <th>Stato</th>
                    <th>Azione</th>
                  </tr>
                  <tr>
                    <th></th>
                    <th>
                      <input type="text" value={nameFilter} onChange={(e) => setNameFilter(e.target.value)} placeholder="Filtra per nome..." />
                    </th>
                    <th></th>
                    <th>
                      <input type="text" value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} placeholder="Filtra per luogo..." />
                    </th>
                    <th>
                      <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                        <option value="all">Tutti</option>
                        <option value="open">Aperti</option>
                        <option value="closed">Chiusi</option>
                      </select>
                    </th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBatches.length === 0 ? (
                    <tr>
                      <td colSpan={6}>Nessuna iscrizione trovata.</td>
                    </tr>
                  ) : (
                    filteredBatches.map((batch, idx) => (
                      <tr key={batch.id}>
                        <td>{idx + 1}</td>
                        <td>{batch.name}</td>
                        <td>{batch.date}</td>
                        <td>{batch.location}</td>
                        <td>{batch.isClosed ? "Chiuso" : "Aperto"}</td>
                        <td>
                          <Link to={`/gestisci/${batch.batchId}`}>Gestisci</Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </>
        )}

        {/* Modale nuova iscrizione */}
        {modal === "init" && (
          <div className="modal-overlay" onClick={() => setModal(null)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h2>Nuova Iscrizione / Lotto</h2>
              <label>Nome</label>
              <input name="name" value={formData.name} onChange={handleFormChange} />
              <label>Descrizione</label>
              <textarea name="description" value={formData.description} onChange={handleFormChange} />
              <label>Data</label>
              <input type="date" name="date" value={formData.date} onChange={handleFormChange} />
              <label>Luogo</label>
              <input name="location" value={formData.location} onChange={handleFormChange} />
              <label>Immagine</label>
              <input type="file" onChange={handleFileChange} />
              <button>Invia</button>
              <button onClick={() => setModal(null)}>Annulla</button>
            </div>
          </div>
        )}

        {txResult && <TransactionStatusModal status={txResult.status} message={txResult.message} onClose={() => setTxResult(null)} />}
      </div>
    </>
  );
};

export default AziendaPage;
