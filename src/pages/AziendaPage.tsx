import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ConnectButton, useActiveAccount, useReadContract, useSendTransaction } from 'thirdweb/react';
import { createThirdwebClient, getContract, prepareContractCall } from 'thirdweb';
import { polygon } from 'thirdweb/chains';
import { inAppWallet } from 'thirdweb/wallets';
import { supplyChainABI as abi } from '../abi/contractABI';
import '../App.css'; 

import TransactionStatusModal from '../components/TransactionStatusModal';

// --- Stili CSS (invariati) ---
const AziendaPageStyles = () => (
  <style>{`
    /* Stili globali per la pagina (omessi per brevità) */
    .app-container-full { padding: 0 2rem; }
    .main-header-bar { display: flex; justify-content: space-between; align-items: center; }
    .header-title { font-size: 1.75rem; font-weight: bold; }
    .dashboard-header-card { display: flex; justify-content: space-between; align-items: center; position: relative; padding: 1.5rem; background-color: #212529; border: 1px solid #495057; border-radius: 8px; margin-bottom: 2rem; }
    .dashboard-header-info { display: flex; flex-direction: column; }
    .company-name-header { margin-top: 0; margin-bottom: 1rem; font-size: 3rem; }
    .company-status-container { display: flex; align-items: center; gap: 1.5rem; }
    .status-item { display: flex; align-items: center; gap: 0.5rem; }
    .header-actions .web3-button.large { padding: 1rem 2rem; font-size: 1.1rem; }
    .company-table .desktop-row { display: table-row; }
    .company-table .mobile-card { display: none; }
    .pagination-controls { display: flex; justify-content: space-between; align-items: center; margin-top: 1rem; }
    .recap-summary { text-align: left; padding: 15px; background-color: #2a2a2a; border: 1px solid #444; border-radius: 8px; margin-bottom: 20px;}
    .recap-summary p { margin: 8px 0; word-break: break-word; }
    .recap-summary p strong { color: #f8f9fa; }
    @media (max-width: 768px) {
        .app-container-full { padding: 0 1rem; }
        .main-header-bar { flex-direction: column; align-items: flex-start; gap: 1rem; }
        .header-title { font-size: 1.5rem; }
        .wallet-button-container { align-self: flex-start; }
        .dashboard-header-card { flex-direction: column; align-items: flex-start; gap: 1.5rem; }
        .company-name-header { font-size: 2.2rem; }
        .company-status-container { flex-direction: column; align-items: flex-start; gap: 0.75rem; }
        .header-actions { width: 100%; }
        .header-actions .web3-button.large { width: 100%; font-size: 1rem; }
        .company-table thead { display: none; }
        .company-table .desktop-row { display: none; }
        .company-table tbody, .company-table tr, .company-table td { display: block; width: 100%; }
        .company-table tr { margin-bottom: 1rem; }
        .company-table td[colspan="7"] { padding: 20px; text-align: center; border: 1px solid #495057; border-radius: 8px; }
        .mobile-card { display: block; border: 1px solid #495057; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; background-color: #2c3e50; }
        .mobile-card .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; border-bottom: 1px solid #495057; padding-bottom: 0.75rem; }
        .mobile-card .card-header strong { font-size: 1.1rem; }
        .mobile-card .card-body p { margin: 0.5rem 0; }
        .mobile-card .card-body p strong { color: #bdc3c7; }
        .mobile-card .card-footer { margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #495057; }
        .mobile-card .web3-button { width: 100%; text-align: center; }
        .pagination-controls { flex-direction: column; gap: 1rem; }
    }
  `}</style>
);

const client = createThirdwebClient({ clientId: "eda8282e23ee12f17d8d1d20ef8aaa83" });
const contract = getContract({ 
  client, 
  chain: polygon,
  address: "0x2Bd72307a73cC7BE3f275a81c8eDBE775bB08F3E"
});

const RegistrationForm = () => ( <div className="card"><h3>Benvenuto su Easy Chain!</h3><p>Il tuo account non è ancora attivo. Compila il form di registrazione per inviare una richiesta di attivazione.</p></div> );

interface BatchData { id: string; batchId: bigint; name: string; description: string; date: string; location: string; imageIpfsHash: string; contributorName: string; isClosed: boolean; }

const BatchRow = ({ batch, localId }: { batch: BatchData; localId: number }) => {
    const [showDescription, setShowDescription] = useState(false);
    const { data: stepCount } = useReadContract({ contract, abi, method: "function getBatchStepCount(uint256 _batchId) view returns (uint256)", params: [batch.batchId] });
    const formatDate = (dateStr: string | undefined) => !dateStr || dateStr.split('-').length !== 3 ? '/' : dateStr.split('-').reverse().join('/');
    return (
        <>
            <tr className="desktop-row">
                <td>{localId}</td>
                <td><span className="clickable-name" onClick={() => setShowDescription(true)}>{batch.name || '/'}</span></td>
                <td>{formatDate(batch.date)}</td>
                <td>{batch.location || '/'}</td>
                <td>{stepCount !== undefined ? stepCount.toString() : '/'}</td>
                <td>{batch.isClosed ? <span className="status-closed">✅ Chiuso</span> : <span className="status-open">⏳ Aperto</span>}</td>
                <td><Link to={`/gestisci/${batch.batchId}`} className="web3-button">Gestisci</Link></td>
            </tr>
            <tr className="mobile-card">
                <td>
                    <div className="card-header"><strong className="clickable-name" onClick={() => setShowDescription(true)}>{batch.name || 'N/A'}</strong><span className={`status ${batch.isClosed ? 'status-closed' : 'status-open'}`}>{batch.isClosed ? '✅ Chiuso' : '⏳ Aperto'}</span></div>
                    <div className="card-body"><p><strong>ID:</strong> {localId}</p><p><strong>Data:</strong> {formatDate(batch.date)}</p><p><strong>Luogo:</strong> {batch.location || '/'}</p><p><strong>N° Passaggi:</strong> {stepCount !== undefined ? stepCount.toString() : '/'}</p></div>
                    <div className="card-footer"><Link to={`/gestisci/${batch.batchId}`} className="web3-button">Gestisci</Link></div>
                </td>
            </tr>
            {showDescription && (
                <div className="modal-overlay" onClick={() => setShowDescription(false)}>
                    <div className="modal-content description-modal" onClick={(e) => e.stopPropagation()}><div className="modal-header"><h2>Descrizione Iscrizione / Lotto</h2></div><div className="modal-body"><p>{batch.description || 'Nessuna descrizione fornita.'}</p></div><div className="modal-footer"><button onClick={() => setShowDescription(false)} className="web3-button">Chiudi</button></div></div>
                </div>
            )}
        </>
    );
};

const BatchTable = ({ batches, nameFilter, setNameFilter, locationFilter, setLocationFilter, statusFilter, setStatusFilter }: any) => {
    const [currentPage, setCurrentPage] = useState(1); const [itemsToShow, setItemsToShow] = useState(10); const MAX_PER_PAGE = 30; const totalPages = Math.max(1, Math.ceil(batches.length / MAX_PER_PAGE)); const startIndex = (currentPage - 1) * MAX_PER_PAGE; const itemsOnCurrentPage = batches.slice(startIndex, startIndex + MAX_PER_PAGE); const visibleBatches = itemsOnCurrentPage.slice(0, itemsToShow); useEffect(() => { setCurrentPage(1); setItemsToShow(10); }, [batches, nameFilter, locationFilter, statusFilter]); const handleLoadMore = () => setItemsToShow(prev => Math.min(prev + 10, MAX_PER_PAGE)); const handlePageChange = (page: number) => { if (page < 1 || page > totalPages) return; setCurrentPage(page); setItemsToShow(10); };
    return (
        <div className="table-container">
            <table className="company-table">
                <thead>
                    <tr className="desktop-row"><th>ID</th><th>Nome</th><th>Data</th><th>Luogo</th><th>N° Passaggi</th><th>Stato</th><th>Azione</th></tr>
                    <tr className="filter-row"><th></th><th><input type="text" placeholder="Filtra per nome..." className="filter-input" value={nameFilter} onChange={(e) => setNameFilter(e.target.value)} /></th><th></th><th><input type="text" placeholder="Filtra per luogo..." className="filter-input" value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} /></th><th></th><th><select className="filter-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="all">Tutti</option><option value="open">Aperto</option><option value="closed">Chiuso</option></select></th><th></th></tr>
                </thead>
                <tbody>{visibleBatches.length > 0 ? (visibleBatches.map((batch, index) => <BatchRow key={batch.id} batch={batch} localId={startIndex + index + 1} />)) : (<tr><td colSpan={7} style={{textAlign: 'center', padding: '2rem'}}>Nessuna iscrizione trovata.</td></tr>)}</tbody>
            </table>
            <div className="pagination-controls">{itemsToShow < itemsOnCurrentPage.length && (<button onClick={handleLoadMore} className='link-button'>Vedi altri 10...</button>)}<div className="page-selector">{totalPages > 1 && <> <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}>&lt;</button> <span> Pagina {currentPage} di {totalPages} </span> <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}>&gt;</button></>}</div></div>
        </div>
    );
};

const DashboardHeader = ({ contributorInfo, onNewInscriptionClick }: { contributorInfo: readonly [string, bigint, boolean], onNewInscriptionClick: () => void }) => {
    const companyName = contributorInfo[0] || 'Azienda'; const credits = contributorInfo[1].toString();
    return (
        <div className="dashboard-header-card">
            <div className="dashboard-header-info"><h2 className="company-name-header">{companyName}</h2><div className="company-status-container"><div className="status-item"><span>Crediti Rimanenti: <strong>{credits}</strong></span></div><div className="status-item"><span>Stato: <strong>ATTIVO</strong></span><span className="status-icon">✅</span></div></div></div>
            <div className="header-actions"><button className="web3-button large" onClick={onNewInscriptionClick}>Nuova Iscrizione</button></div>
        </div>
    );
};

const getInitialFormData = () => ({ name: "", description: "", date: "", location: "" });
const truncateText = (text: string, maxLength: number) => { if (!text) return text; return text.length > maxLength ? text.substring(0, maxLength) + "..." : text; };

export default function AziendaPage() {
    const account = useActiveAccount();
    
    const { data: contributorData, isLoading: isStatusLoading, refetch: refetchContributorInfo, isError } = useReadContract({ 
        contract, 
        method: "function getContributorInfo(address) view returns (string, uint256, bool)", 
        params: account ? [account.address] : undefined, 
        queryOptions: { 
            enabled: !!account,
            refetchInterval: false
        } 
    });

    const prevAccountRef = useRef(account?.address);
    const { mutate: sendTransaction, isPending } = useSendTransaction();
    const [modal, setModal] = useState<'init' | null>(null);
    const [formData, setFormData] = useState(getInitialFormData());
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [txResult, setTxResult] = useState<{ status: 'success' | 'error'; message: string } | null>(null);
    const [allBatches, setAllBatches] = useState<BatchData[]>([]);
    const [filteredBatches, setFilteredBatches] = useState<BatchData[]>([]);
    const [isLoadingBatches, setIsLoadingBatches] = useState(true);
    const [nameFilter, setNameFilter] = useState('');
    const [locationFilter, setLocationFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [loadingMessage, setLoadingMessage] = useState('');
    const [currentStep, setCurrentStep] = useState(1);

    const fetchAllBatches = async () => {
        if (!account?.address) return;
        setIsLoadingBatches(true);

        const insightBaseUrl = 'https://polygon.insight.thirdweb.com';
        const contractAddress = '0x2Bd72307a73cC7BE3f275a81c8eDBE775bB08F3E';
        const headers = { 'x-client-id': 'eda8282e23ee12f17d8d1d20ef8aaa83' };

        // --- CODICE DIAGNOSTICO ---
        const richEventSignature = encodeURIComponent('BatchInitialized(address,uint256,string,string,string,string,string,string,bool)');
        const poorEventSignature = encodeURIComponent('BatchInitialized(address,uint256,string)'); // Vecchia firma per test

        const richUrl = new URL(`${insightBaseUrl}/v1/contracts/${contractAddress}/events/${richEventSignature}`);
        richUrl.searchParams.append('contributor', account.address);
        richUrl.searchParams.append('order', 'desc');

        const poorUrl = new URL(`${insightBaseUrl}/v1/contracts/${contractAddress}/events/${poorEventSignature}`);
        poorUrl.searchParams.append('contributor', account.address);
        poorUrl.searchParams.append('order', 'desc');

        try {
            console.log("--- INIZIO TEST DIAGNOSTICO INSIGHT ---");
            console.log("1. Tento di caricare gli eventi 'ricchi' (quelli corretti)...");
            const richResponse = await fetch(richUrl.toString(), { headers });
            console.log(`Risposta per evento ricco: ${richResponse.status} ${richResponse.statusText}`);

            if (richResponse.ok) {
                const events = await richResponse.json();
                console.log("SUCCESSO! Trovati eventi ricchi:", events);
                const formattedBatches = events.map((event: any) => ({
                    id: event.arguments.batchId.toString(),
                    batchId: BigInt(event.arguments.batchId),
                    name: event.arguments.name,
                    description: event.arguments.description,
                    date: event.arguments.date,
                    location: event.arguments.location,
                    imageIpfsHash: event.arguments.imageIpfsHash,
                    contributorName: event.arguments.contributorName,
                    isClosed: event.arguments.isClosed,
                }));
                setAllBatches(formattedBatches);
            } else {
                console.log("2. Chiamata per evento 'ricco' fallita. Tento di caricare gli eventi 'poveri' per diagnosi...");
                const poorResponse = await fetch(poorUrl.toString(), { headers });
                console.log(`Risposta per evento povero: ${poorResponse.status} ${poorResponse.statusText}`);

                if (poorResponse.ok) {
                    const events = await poorResponse.json();
                    console.error("DIAGNOSI CONFERMATA: Trovati solo eventi 'poveri'. Questo significa che la versione del contratto deployata è quella vecchia. È necessario fare il deploy del contratto aggiornato.", events);
                    alert("Errore di configurazione: la versione del contratto sulla blockchain non è aggiornata. Controlla la console per i dettagli.");
                    setAllBatches([]);
                } else {
                    console.error("DIAGNOSI: Entrambe le chiamate sono fallite. L'evento 'BatchInitialized' potrebbe non essere mai stato emesso, oppure c'è un problema con la configurazione di Insight o del Paymaster.");
                    alert("Errore: Impossibile caricare i dati da Insight. Controlla la console per i dettagli.");
                    setAllBatches([]);
                }
            }
        } catch (error) {
            console.error("Errore critico durante la chiamata a Insight:", error);
            setAllBatches([]);
        } finally {
            setIsLoadingBatches(false);
        }
    };

    useEffect(() => {
        if (account?.address && prevAccountRef.current !== account.address) { refetchContributorInfo(); fetchAllBatches(); } 
        else if (account?.address && !prevAccountRef.current) { fetchAllBatches(); }
        else if (!account && prevAccountRef.current) { window.location.href = '/'; }
        prevAccountRef.current = account?.address;
    }, [account]);

    useEffect(() => {
        let tempBatches = [...allBatches];
        if (nameFilter) tempBatches = tempBatches.filter(b => b.name.toLowerCase().includes(nameFilter.toLowerCase()));
        if (locationFilter) tempBatches = tempBatches.filter(b => b.location.toLowerCase().includes(locationFilter.toLowerCase()));
        if (statusFilter !== 'all') { const isOpen = statusFilter === 'open'; tempBatches = tempBatches.filter(b => !b.isClosed === isOpen); }
        setFilteredBatches(tempBatches);
    }, [nameFilter, locationFilter, statusFilter, allBatches]);
    
    const handleModalInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { setFormData(prev => ({...prev, [e.target.name]: e.target.value})); };
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { setSelectedFile(e.target.files?.[0] || null); };
    
    const handleInitializeBatch = async () => {
        if (!formData.name.trim()) { setTxResult({ status: 'error', message: 'Il campo Nome è obbligatorio.' }); return; }
        setLoadingMessage('Preparazione transazione...');
        let imageIpfsHash = "N/A";
        if (selectedFile) {
            const MAX_SIZE_MB = 5; const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024; const ALLOWED_FORMATS = ['image/png', 'image/jpeg', 'image/webp'];
            if (selectedFile.size > MAX_SIZE_BYTES) { setTxResult({ status: 'error', message: `File troppo grande. Limite: ${MAX_SIZE_MB} MB.` }); return; }
            if (!ALLOWED_FORMATS.includes(selectedFile.type)) { setTxResult({ status: 'error', message: 'Formato immagine non supportato.' }); return; }
            setLoadingMessage('Caricamento Immagine...');
            try {
                const body = new FormData(); body.append('file', selectedFile); body.append('companyName', contributorData?.[0] || 'AziendaGenerica');
                const response = await fetch('/api/upload', { method: 'POST', body });
                if (!response.ok) { 
                    const errorText = await response.text();
                    throw new Error(`Errore del server: ${errorText}`); 
                }
                const { cid } = await response.json(); if (!cid) throw new Error("CID non ricevuto dall'API di upload."); imageIpfsHash = cid;
            } catch (error: any) { setTxResult({ status: 'error', message: `Errore caricamento: ${error.message}` }); setLoadingMessage(''); return; }
        }
        setLoadingMessage('Transazione in corso...');
        const transaction = prepareContractCall({ contract, abi, method: "function initializeBatch(string,string,string,string,string)", params: [formData.name, formData.description, formData.date, formData.location, imageIpfsHash] });
        sendTransaction(transaction, { 
            onSuccess: () => { 
                setTxResult({ status: 'success', message: 'Iscrizione creata con successo!' }); 
                setLoadingMessage(''); 
                console.log("Transazione riuscita. Attendo 4 secondi prima di aggiornare la lista...");
                setTimeout(() => {
                    console.log("Timeout terminato. Eseguo il refetch...");
                    fetchAllBatches();
                    refetchContributorInfo();
                }, 4000);
            },
            onError: (err) => { 
                console.error("Dettagli errore transazione:", err);
                const errorMessage = err.message.toLowerCase();
                let displayMessage = "Errore generico nella transazione. Controlla la console per i dettagli.";

                if (errorMessage.includes("insufficient funds") || errorMessage.includes("contributor has no credits")) {
                    displayMessage = "Crediti insufficienti. Per favore, contatta l'amministratore per una ricarica.";
                } else if (errorMessage.includes("not an active contributor")) {
                    displayMessage = "Il tuo account non risulta essere un contributor attivo.";
                } else {
                    const reasonMatch = err.message.match(/reason="([^"]+)"/);
                    if (reasonMatch && reasonMatch[1]) {
                        displayMessage = `Errore: ${reasonMatch[1]}`;
                    }
                }
                setTxResult({ status: 'error', message: displayMessage });
                setLoadingMessage(''); 
            } 
        });
    };
    
    const openModal = () => { setFormData(getInitialFormData()); setSelectedFile(null); setCurrentStep(1); setTxResult(null); setModal('init'); }
    const handleCloseModal = () => setModal(null);
    const handleNextStep = () => { if (currentStep === 1 && !formData.name.trim()) { alert("Il campo 'Nome Iscrizione' è obbligatorio."); return; } if (currentStep < 6) setCurrentStep(prev => prev + 1); };
    const handlePrevStep = () => { if (currentStep > 1) setCurrentStep(prev => prev - 1); };
    
    if (!account) { return <div className='login-container'><AziendaPageStyles /><ConnectButton client={client} chain={polygon} accountAbstraction={{ chain: polygon, sponsorGas: true }} wallets={[inAppWallet()]} connectButton={{ label: "Connettiti / Log In", style: { fontSize: '1.2rem', padding: '1rem 2rem' } }} /></div>; }
    
    const renderDashboardContent = () => { 
        if (isStatusLoading) return <p style={{textAlign: 'center', marginTop: '4rem'}}>Verifica stato account...</p>; 
        if (isError || !contributorData) return <p style={{textAlign: 'center', marginTop: '4rem', color: 'red'}}>Errore nel recuperare i dati dell'account. Riprova.</p>
        if (!contributorData[2]) return <RegistrationForm />; 
        return (
            <> 
                <DashboardHeader contributorInfo={contributorData} onNewInscriptionClick={openModal} /> 
                
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '1rem', gap: '1rem' }}>
                    <h3 style={{ margin: 0, color: '#f8f9fa' }}>Le tue Iscrizioni</h3>
                    <button onClick={() => fetchAllBatches()} className="web3-button secondary" disabled={isLoadingBatches} style={{padding: '8px 16px'}}>
                        {isLoadingBatches ? 'Aggiornando...' : 'Aggiorna Lista'}
                    </button>
                </div>

                {isLoadingBatches ? <p style={{textAlign: 'center', marginTop: '2rem'}}>Caricamento iscrizioni...</p> : <BatchTable batches={filteredBatches} nameFilter={nameFilter} setNameFilter={setNameFilter} locationFilter={locationFilter} setLocationFilter={setLocationFilter} statusFilter={statusFilter} setStatusFilter={setStatusFilter}/>} 
            </>
        ); 
    };
    
    const isProcessing = loadingMessage !== '' || isPending;
    const today = new Date().toISOString().split('T')[0];
    const helpTextStyle = { backgroundColor: '#343a40', border: '1px solid #495057', borderRadius: '8px', padding: '16px', marginTop: '16px', fontSize: '0.9rem', color: '#f8f9fa' };

    return (
        <div className="app-container-full">
            <AziendaPageStyles />
            <header className="main-header-bar"><div className="header-title">EasyChain - Area Riservata</div><div className="wallet-button-container"><ConnectButton client={client} chain={polygon} detailsModal={{ hideSend: true, hideReceive: true, hideBuy: true, hideTransactionHistory: true }}/></div></header>
            <main className="main-content-full">{renderDashboardContent()}</main>
            
            {modal === 'init' && ( 
                <div className="modal-overlay" onClick={handleCloseModal}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header"><h2>Nuova Iscrizione ({currentStep}/6)</h2></div>
                        <div className="modal-body" style={{ minHeight: '350px' }}>
                            {currentStep === 1 && (
                                <div>
                                    <div className="form-group"><label>Nome Iscrizione <span style={{color: 'red', fontWeight:'bold'}}>* Obbligatorio</span></label><input type="text" name="name" value={formData.name} onChange={handleModalInputChange} className="form-input" maxLength={100} /><small className="char-counter">{formData.name.length} / 100</small></div>
                                    <div style={helpTextStyle}><p><strong>ℹ️ Come scegliere il Nome Iscrizione</strong></p><p>Il Nome Iscrizione è un'etichetta descrittiva che ti aiuta a identificare in modo chiaro ciò che stai registrando on-chain. Ad esempio:</p><ul style={{textAlign: 'left', paddingLeft: '20px'}}><li>Il nome di un prodotto o varietà: <em>Pomodori San Marzano 2025</em></li><li>Il numero di lotto: <em>Lotto LT1025 – Olio EVO 3L</em></li><li>Il nome di un contratto: <em>Contratto fornitura COOP – Aprile 2025</em></li><li>Una certificazione o audit: <em>Certificazione Bio ICEA 2025</em></li><li>Un riferimento amministrativo: <em>Ordine n.778 – Cliente NordItalia</em></li></ul><p style={{marginTop: '1rem'}}><strong>📌 Consiglio:</strong> scegli un nome breve ma significativo, che ti aiuti a ritrovare facilmente l’iscrizione anche dopo mesi o anni.</p></div>
                                </div>
                            )}
                            {currentStep === 2 && (
                                <div>
                                    <div className="form-group"><label>Descrizione <span style={{color: '#6c757d'}}>Non obbligatorio</span></label><textarea name="description" value={formData.description} onChange={handleModalInputChange} className="form-input" rows={4} maxLength={500}></textarea><small className="char-counter">{formData.description.length} / 500</small></div>
                                    <div style={helpTextStyle}><p>Inserisci una descrizione del prodotto, lotto, contratto o altro elemento principale. Fornisci tutte le informazioni essenziali per identificarlo chiaramente nella filiera o nel contesto dell’iscrizione.</p></div>
                                </div>
                            )}
                            {currentStep === 3 && (
                                <div>
                                    <div className="form-group"><label>Luogo <span style={{color: '#6c757d'}}>Non obbligatorio</span></label><input type="text" name="location" value={formData.location} onChange={handleModalInputChange} className="form-input" maxLength={100} /><small className="char-counter">{formData.location.length} / 100</small></div>
                                    <div style={helpTextStyle}><p>Inserisci il luogo di origine o di produzione del prodotto o lotto. Può essere una città, una regione, un'azienda agricola o uno stabilimento specifico per identificare con precisione dove è stato realizzato.</p></div>
                                </div>
                            )}
                            {currentStep === 4 && (
                                <div>
                                    <div className="form-group"><label>Data <span style={{color: '#6c757d'}}>Non obbligatorio</span></label><input type="date" name="date" value={formData.date} onChange={handleModalInputChange} className="form-input" max={today} /></div>
                                    <div style={helpTextStyle}><p>Inserisci una data, puoi utilizzare il giorno attuale o una data precedente alla conferma di questa Iscrizione.</p></div>
                                </div>
                            )}
                            {currentStep === 5 && (
                                <div>
                                    <div className="form-group"><label>Immagine <span style={{color: '#6c757d'}}>Non obbligatorio</span></label><input type="file" name="image" onChange={handleFileChange} className="form-input" accept="image/png, image/jpeg, image/webp"/><small style={{marginTop: '4px'}}>Formati: PNG, JPG, WEBP. Max: 5 MB.</small>{selectedFile && <p className="file-name-preview">File: {selectedFile.name}</p>}</div>
                                    <div style={helpTextStyle}><p>Carica un’immagine rappresentativa del prodotto, lotto, contratto, etc. Rispetta i formati e i limiti di peso.</p><p style={{marginTop: '10px'}}><strong>Consiglio:</strong> Per una visualizzazione ottimale, usa un'immagine quadrata (formato 1:1).</p></div>
                                </div>
                            )}
                             {currentStep === 6 && (
                                <div>
                                    <h4>Riepilogo Dati</h4>
                                    <div className="recap-summary">
                                        <p><strong>Nome:</strong> {truncateText(formData.name, 40) || 'Non specificato'}</p>
                                        <p><strong>Descrizione:</strong> {truncateText(formData.description, 60) || 'Non specificata'}</p>
                                        <p><strong>Luogo:</strong> {truncateText(formData.location, 40) || 'Non specificato'}</p>
                                        <p><strong>Data:</strong> {formData.date ? formData.date.split('-').reverse().join('/') : 'Non specificata'}</p>
                                        <p><strong>Immagine:</strong> {truncateText(selectedFile?.name || '', 40) || 'Nessuna'}</p>
                                    </div>
                                    <p>Vuoi confermare e registrare questi dati sulla blockchain?</p>
                                </div>
                            )}
                        </div>
                        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
                            <div>{currentStep > 1 && <button onClick={handlePrevStep} className="web3-button secondary" disabled={isProcessing}>Indietro</button>}</div>
                            <div>
                                <button onClick={handleCloseModal} className="web3-button secondary" disabled={isProcessing}>Chiudi</button>
                                {currentStep < 6 && <button onClick={handleNextStep} className="web3-button">Avanti</button>}
                                {currentStep === 6 && <button onClick={handleInitializeBatch} disabled={isProcessing} className="web3-button">{isProcessing ? "Conferma..." : "Conferma e Registra"}</button>}
                            </div>
                        </div>
                    </div>
                </div> 
            )}
            
            {isProcessing && <TransactionStatusModal status={'loading'} message={loadingMessage} onClose={() => {}} />}
            {txResult && <TransactionStatusModal status={txResult.status} message={txResult.message} onClose={() => { if (txResult.status === 'success') handleCloseModal(); setTxResult(null); }} />}
        </div>
    );
}
