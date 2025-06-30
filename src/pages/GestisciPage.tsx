import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ConnectButton, useActiveAccount, useReadContract, useSendTransaction } from 'thirdweb/react';
import { createThirdwebClient, getContract, prepareContractCall } from 'thirdweb';
import { polygon } from 'thirdweb/chains';
import { supplyChainABI as abi } from '../abi/contractABI';
import '../App.css';
import TransactionStatusModal from '../components/TransactionStatusModal';

const client = createThirdwebClient({ clientId: "eda8282e23ee12f17d8d1d20ef8aaa83" });
const contract = getContract({ 
  client, 
  chain: polygon,
  address: "0xACa1fA95E1b8C52398BeA2C708be7a164D897450"
});

const EventoCard = ({ eventoInfo }: { eventoInfo: any }) => (
    <div className="card" style={{backgroundColor: '#343a40', color: '#f8f9fa', marginTop: '1rem'}}>
        <h4>{eventoInfo.eventName}</h4>
        <p>{eventoInfo.description}</p>
        <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#adb5bd'}}>
            <span>Luogo: {eventoInfo.location}</span>
            <span>Data: {eventoInfo.date}</span>
        </div>
        {eventoInfo.attachmentsIpfsHash && eventoInfo.attachmentsIpfsHash !== "N/A" && (
             <a href={`https://musical-emerald-partridge.myfilebase.com/ipfs/${eventoInfo.attachmentsIpfsHash}`} target="_blank" rel="noopener noreferrer" className="link-button" style={{marginTop: '1rem'}}>
                 Vedi Documento Allegato
             </a>
        )}
    </div>
);

const AggiungiEventoModal = ({ batchId, contributorName, onClose, onSuccess }: { batchId: bigint, contributorName: string, onClose: () => void, onSuccess: () => void }) => {
    const [currentStep, setCurrentStep] = useState(1);
    const [formData, setFormData] = useState({ eventName: "", description: "", date: new Date().toISOString().split('T')[0], location: "" });
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [txResult, setTxResult] = useState<{ status: 'success' | 'error'; message: string } | null>(null);
    const { mutate: sendTransaction, isPending } = useSendTransaction();

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({...prev, [name]: value}));
    };
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => setSelectedFile(e.target.files?.[0] || null);

    const handleAddEvento = async () => {
        let attachmentsIpfsHash = "N/A";
        if (selectedFile) {
            const MAX_SIZE_MB = 5;
            const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
            const ALLOWED_FORMATS = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/plain', 'text/csv'];
            
            if (selectedFile.size > MAX_SIZE_BYTES) {
                setTxResult({ status: 'error', message: `Il file è troppo grande. Limite massimo: ${MAX_SIZE_MB} MB.` }); return;
            }
            if (!ALLOWED_FORMATS.includes(selectedFile.type)) {
                setTxResult({ status: 'error', message: 'Formato file non supportato.' }); return;
            }
            setLoadingMessage('Caricamento allegato, attendi...');
            try {
                const body = new FormData();
                body.append('file', selectedFile);
                body.append('companyName', contributorName);
                const response = await fetch('/api/upload', { method: 'POST', body });
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Errore del server: ${errorText}`);
                }
                const { cid } = await response.json();
                if (!cid) throw new Error("CID non ricevuto dalla nostra API.");
                attachmentsIpfsHash = cid;
            } catch (error: any) {
                setTxResult({ status: 'error', message: `Errore caricamento: ${error.message}` });
                setLoadingMessage(''); return;
            }
        }

        setLoadingMessage('Transazione in corso, attendi...');
        const transaction = prepareContractCall({ 
            contract, abi, 
            method: "function addStepToBatch(uint256 _batchId, string _eventName, string _description, string _date, string _location, string _attachmentsIpfsHash)", 
            params: [batchId, formData.eventName, formData.description, formData.date, formData.location, attachmentsIpfsHash] 
        });

        sendTransaction(transaction, { 
            onSuccess: () => { setLoadingMessage(''); onSuccess(); },
            onError: (err) => { setLoadingMessage(''); setTxResult({ status: 'error', message: err.message }); } 
        });
    };
    
    const handleConfirmAndSubmit = () => {
        if (window.confirm("Vuoi confermare tutti i dati inseriti e procedere scrivere l'evento?")) {
            handleAddEvento();
        }
    };

    const handleNextStep = () => {
        if (currentStep === 1 && !formData.eventName.trim()) {
            alert("Il campo 'Nome Evento' è obbligatorio per procedere."); return;
        }
        setCurrentStep(prev => prev + 1);
    };

    const helpTextStyle = { backgroundColor: '#343a40', border: '1px solid #495057', borderRadius: '8px', padding: '16px', marginTop: '16px', fontSize: '0.9rem', color: '#f8f9fa' };
    const isProcessing = loadingMessage !== '' || isPending;

    return (
        <>
            <div className="modal-overlay" onClick={onClose}>
                <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                    <div className="modal-header"><h2>Aggiungi Nuovo Evento ({currentStep}/5)</h2></div>
                    <div className="modal-body" style={{ minHeight: '350px' }}>
                        {currentStep === 1 && <div> <div className="form-group"> <label>Nome Evento <span style={{color: 'red', fontWeight:'bold'}}>* Obbligatorio</span></label> <input type="text" name="eventName" value={formData.eventName} onChange={handleInputChange} className="form-input" maxLength={100} /> <small className="char-counter">{formData.eventName.length} / 100</small> </div> <div style={helpTextStyle}><p>Inserisci un nome identificativo per questo evento, può essere un'operazione specifica (come "Raccolta", "Trasformazione", "Spedizione"), un controllo di qualità, un passaggio logistico, un aggiornamento contrattuale o qualsiasi attività rilevante per la tracciabilità del prodotto. Scegli un nome descrittivo che aiuti a comprendere subito di cosa si tratta.</p></div> </div>}
                        {currentStep === 2 && <div> <div className="form-group"> <label>Descrizione <span style={{color: '#6c757d'}}>Non obbligatorio</span></label> <textarea name="description" value={formData.description} onChange={handleInputChange} className="form-input" rows={4} maxLength={500}></textarea> <small className="char-counter">{formData.description.length} / 500</small> </div> <div style={helpTextStyle}><p>Fornisci una breve descrizione di cosa è avvenuto in questo evento: specifica le attività svolte, i dettagli rilevanti, eventuali soggetti coinvolti o note tecniche utili per la tracciabilità.</p></div> </div>}
                        {currentStep === 3 && <div> <div className="form-group"> <label>Luogo <span style={{color: '#6c757d'}}>Non obbligatorio</span></label> <input type="text" name="location" value={formData.location} onChange={handleInputChange} className="form-input" maxLength={100} /> <small className="char-counter">{formData.location.length} / 100</small> </div> <div style={helpTextStyle}><p>Inserisci il luogo dove si è svolto questo evento (es. un magazzino, un laboratorio, un punto vendita, ecc.).</p></div> </div>}
                        {currentStep === 4 && <div> <div className="form-group"> <label>Data <span style={{color: '#6c757d'}}>Non obbligatorio</span></label> <input type="date" name="date" value={formData.date} onChange={handleInputChange} className="form-input" max={new Date().toISOString().split('T')[0]} /> </div> <div style={helpTextStyle}><p>Inserisci la data in cui si è verificato l'evento.</p></div> </div>}
                        {currentStep === 5 && <div> <div className="form-group"> <label>Carica Allegato <span style={{color: '#6c757d'}}>Non obbligatorio</span></label> <input type="file" name="attachment" onChange={handleFileChange} className="form-input" accept=".jpg, .jpeg, .png, .webp, .pdf, .docx, .xlsx, .txt, .csv"/> {selectedFile && <p className="file-name-preview">File selezionato: {selectedFile.name}</p>} <small style={{marginTop: '4px'}}>Formati supportati. Max: 5 MB.</small> </div> <div style={helpTextStyle}><p>Allega un documento o un'immagine relativa a questo evento (es. bolla di trasporto, certificato di analisi, foto del prodotto, ecc.).</p></div> </div>}
                    </div>
                    <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
                        <div>{currentStep > 1 && <button onClick={() => setCurrentStep(p => p - 1)} className="web3-button secondary">Indietro</button>}</div>
                        <div>
                            <button onClick={onClose} className="web3-button secondary">Chiudi</button>
                            {currentStep < 5 && <button onClick={handleNextStep} className="web3-button">Avanti</button>}
                            {currentStep === 5 && <button onClick={handleConfirmAndSubmit} disabled={isProcessing} className="web3-button">{isProcessing ? "..." : "Conferma"}</button>}
                        </div>
                    </div>
                </div>
            </div>
            {isProcessing && <TransactionStatusModal status={'loading'} message={loadingMessage} onClose={() => {}} />}
            {txResult && <TransactionStatusModal status={txResult.status} message={txResult.message} onClose={() => setTxResult(null)} />}
        </>
    );
};

const GestisciPageHeader = ({ contributorInfo }: { contributorInfo: any }) => {
    const companyName = contributorInfo?.[0] || 'Azienda';
    const credits = contributorInfo?.[1]?.toString() || '...';
    return (
        <div className="dashboard-header-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
                <h2 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '3rem' }}>{companyName}</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <div className="status-item"><span>Crediti Rimanenti: <strong>{credits}</strong></span></div>
                    <div className="status-item" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span>Stato: <strong>ATTIVO</strong></span><span className="status-icon">✅</span></div>
                </div>
            </div>
            <div>
                <Link to="/">
                    <button style={{backgroundColor: '#6A5ACD', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '8px', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold'}}>
                        ← Torna alla Pagina Principale
                    </button>
                </Link>
            </div>
        </div>
    );
};

const ImagePlaceholder = () => ( <div style={{width:'150px',height:'150px',flexShrink:0,backgroundColor:'#f0f0f0',border:'1px solid #ddd',borderRadius:'8px',display:'flex',flexDirection:'column',justifyContent:'center',alignItems:'center',color:'#a0a0a0',textAlign:'center'}}><svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="currentColor" viewBox="0 0 16 16"><path d="M6.002 5.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z"/><path d="M2.002 1a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2h-12zm12 1a1 1 0 0 1 1 1v6.5l-3.777-1.947a.5.5 0 0 0-.577.093l-3.71 3.71-2.66-1.772a.5.5 0 0 0-.63.062L1.002 12V3a1 1 0 0 1 1-1h12z"/></svg><div style={{fontSize:'0.8rem',marginTop:'5px',fontWeight:'bold'}}>NO IMAGE<br/>AVAILABLE</div></div> );

const BatchSummaryCard = ({ batchInfo, eventCount, onAddEventoClick, onFinalize }: { batchInfo: any, eventCount: number, onAddEventoClick: () => void, onFinalize: () => void }) => {
    if(!batchInfo) return null;
    
    const defaultImageUrl="https://musical-emerald-partridge.myfilebase.com/ipfs/QmNUGt9nxmkV27qF56jFAG9FUPABvGww5TTW9R9vh2TdvB";
    const imageUrl=batchInfo.imageIpfsHash && batchInfo.imageIpfsHash !=="N/A"?`https://musical-emerald-partridge.myfilebase.com/ipfs/${batchInfo.imageIpfsHash}`:defaultImageUrl;
    const isPlaceholder=imageUrl===defaultImageUrl;
    const isClosed=batchInfo.isClosed;

    const statusIndicatorStyle = { height: '12px', width: '12px', backgroundColor: isClosed ? '#28a745' : '#ffc107', borderRadius: '50%', display: 'inline-block', marginRight: '8px' };

    return(
        <div className="card" style={{marginTop:'1rem',backgroundColor:'transparent',border:'1px solid #8bc4a8',padding:'1.5rem',display:'flex',alignItems:'center',gap:'2rem'}}>
            {isPlaceholder?<ImagePlaceholder />:<img src={imageUrl} alt="Immagine batch" style={{width:'150px',height:'150px',objectFit:'cover',borderRadius:'8px',flexShrink:0}} />}
            <div style={{flex:'1 1 40%',minWidth:0}}>
                <h3 style={{fontWeight:'bold',fontSize:'1.75rem',margin:'0 0 0.5rem 0',color:'white'}}>{batchInfo.name}</h3>
                <p style={{margin:0,color:'#ced4da',fontSize:'0.95rem'}}>{batchInfo.description||'Nessuna descrizione fornita.'}</p>
            </div>
            <div style={{flex:'1 1 25%',color:'#ced4da',textAlign:'left'}}>
                <p style={{margin:'0.3rem 0', display: 'flex', alignItems: 'center'}}>
                    <span style={statusIndicatorStyle}></span>
                    <strong>Stato Iscrizione:</strong> <span style={{fontWeight:'bold', marginLeft: '4px'}}>{isClosed?'Chiuso':'Aperto'}</span>
                </p>
                <p style={{margin:'0.3rem 0'}}><strong>Luogo:</strong> {batchInfo.location||'N/D'}</p>
                <p style={{margin:'0.3rem 0'}}><strong>Data:</strong> {batchInfo.date||'N/D'}</p>
                <p style={{margin:'0.3rem 0'}}><strong>N° Eventi:</strong> {eventCount}</p>
            </div>
            {!isClosed&&(
                <div style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
                    <button onClick={onAddEventoClick} style={{backgroundColor:'#6A5ACD',color:'white',border:'none',padding:'12px 24px',borderRadius:'8px',cursor:'pointer',fontSize:'1rem',fontWeight:'bold',width:'200px'}}>Aggiungi Evento</button>
                    <button onClick={onFinalize} style={{backgroundColor:'#495057',color:'#ced4da',border:'none',padding:'12px 24px',borderRadius:'8px',cursor:'pointer',fontSize:'1rem',fontWeight:'bold',width:'200px'}}>Finalizza Iscrizione</button>
                </div>
            )}
        </div>
    );
};

export default function GestisciPage() {
    const { batchId } = useParams<{ batchId: string }>();
    const account = useActiveAccount();
    const { data: contributorInfo } = useReadContract({ contract, method: "function getContributorInfo(address) view returns (string, uint256, bool)", params: account ? [account.address] : undefined });

    const [batchInfo, setBatchInfo] = useState<any>(null);
    const [eventi, setEventi] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { mutate: sendTransaction, isPending: isFinalizing } = useSendTransaction();
    const [txResult, setTxResult] = useState<{ status: 'success' | 'error'; message: string } | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const fetchBatchData = async () => {
        if (!batchId) return;
        setIsLoading(true);

        const insightBaseUrl = 'https://polygon.insight.thirdweb.com';
        const contractAddress = '0xACa1fA95E1b8C52398BeA2C708be7a164D897450';
        const clientId = 'eda8282e23ee12f17d8d1d20ef8aaa83';

        // --- MODIFICA APPORTATA QUI ---
        // Codifichiamo le firme degli eventi per renderle sicure per l'URL
        const initEventSignature = encodeURIComponent('BatchInitialized(address,uint256,string,string,string,string,string,string,bool)');
        const stepEventSignature = encodeURIComponent('BatchStepAdded(uint256,uint256,string,string,string,string,string)');
        const closeEventSignature = encodeURIComponent('BatchClosed(address,uint256)');
        
        const headers = { 'x-client-id': clientId };

        const initUrl = new URL(`${insightBaseUrl}/v1/contracts/${contractAddress}/events/${initEventSignature}`);
        initUrl.searchParams.append('batchId', batchId);

        const stepsUrl = new URL(`${insightBaseUrl}/v1/contracts/${contractAddress}/events/${stepEventSignature}`);
        stepsUrl.searchParams.append('batchId', batchId);
        stepsUrl.searchParams.append('order', 'desc');

        const closeUrl = new URL(`${insightBaseUrl}/v1/contracts/${contractAddress}/events/${closeEventSignature}`);
        closeUrl.searchParams.append('batchId', batchId);

        try {
            const [initResponse, stepsResponse, closeResponse] = await Promise.all([
                fetch(initUrl.toString(), { headers }),
                fetch(stepsUrl.toString(), { headers }),
                fetch(closeUrl.toString(), { headers })
            ]);

            if (!initResponse.ok || !stepsResponse.ok || !closeResponse.ok) {
                console.error("Init Status:", initResponse.status, "Steps Status:", stepsResponse.status, "Close Status:", closeResponse.status);
                throw new Error("Una delle chiamate a Insight è fallita.");
            }

            const initEvents = await initResponse.json();
            const stepEvents = await stepsResponse.json();
            const closeEvents = await closeResponse.json();

            const mainInfo = initEvents[0]?.arguments;
            if (mainInfo) {
                setBatchInfo({
                    ...mainInfo,
                    isClosed: closeEvents.length > 0
                });
            }

            const formattedSteps = stepEvents.map((event: any) => event.arguments);
            setEventi(formattedSteps);

        } catch (error) {
            console.error("Errore nel caricare i dati del batch da Insight:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchBatchData();
    }, [batchId]);
    
    const handleFinalize = () => {
        const confirmationMessage = "Conferma finalizzazione iscrizione\n\nSei sicuro di voler finalizzare questa iscrizione?\nDopo questa operazione non potrai più aggiungere eventi o modificare la filiera.\nL’iscrizione sarà considerata completa e chiusa.";
        if (!batchId || !window.confirm(confirmationMessage)) return;
        
        const transaction = prepareContractCall({ contract, abi, method: "function closeBatch(uint256 _batchId)", params: [BigInt(batchId)] });
        sendTransaction(transaction, {
            onSuccess: () => { setTxResult({ status: 'success', message: 'Iscrizione finalizzata con successo!' }); fetchBatchData(); },
            onError: (err) => setTxResult({ status: 'error', message: `Errore: ${err.message}` })
        });
    };
    
    const handleAddEventoSuccess = () => {
        setTxResult({ status: 'success', message: 'Evento aggiunto con successo!' });
        setIsModalOpen(false);
        fetchBatchData(); // Ricarica i dati da Insight
    };

    return (
        <div className="app-container-full" style={{ padding: '0 2rem' }}>
            <header className="main-header-bar">
                <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}><div style={{ fontSize: '1.75rem', fontWeight: 'bold' }}>EasyChain - Area Riservata</div></Link>
                <div className="wallet-button-container"><ConnectButton client={client} chain={polygon} detailsModal={{ hideSend: true, hideReceive: true, hideBuy: true, hideTransactionHistory: true }}/></div>
            </header>
            
            <main className="main-content-full">
                {contributorInfo && <GestisciPageHeader contributorInfo={contributorInfo} />}
                
                {isLoading ? <p style={{textAlign: 'center', marginTop: '2rem'}}>Caricamento dati iscrizione...</p> : 
                    <>
                        <BatchSummaryCard batchInfo={batchInfo} eventCount={eventi.length} onAddEventoClick={() => setIsModalOpen(true)} onFinalize={handleFinalize} />
                        
                        <div style={{marginTop: '2rem'}}>
                            <h4>Eventi dell'Iscrizione</h4>
                            {eventi.length === 0 ? (
                                <div style={{textAlign: 'center', padding: '2rem', color: '#adb5bd'}}>
                                    <span style={{fontSize: '3rem', color: '#dc3545', fontWeight: 'bold', lineHeight: '1'}}>×</span>
                                    <p>Nessun Evento aggiunto a questa iscrizione.</p>
                                </div>
                            ) : (
                                eventi.map((evento, index) => <EventoCard key={index} eventoInfo={evento} />)
                            )}
                        </div>
                    </>
                }
            </main>

            {isModalOpen && batchId && (
                <AggiungiEventoModal 
                    batchId={BigInt(batchId)}
                    contributorName={contributorInfo?.[0] || 'AziendaGenerica'}
                    onClose={() => setIsModalOpen(false)} 
                    onSuccess={handleAddEventoSuccess} 
                />
            )}
            
            {isFinalizing && <TransactionStatusModal status="loading" message="Finalizzazione in corso..." onClose={() => {}}/>}
            {txResult && <TransactionStatusModal status={txResult.status} message={txResult.message} onClose={() => setTxResult(null)} />}
        </div>
    );
}
