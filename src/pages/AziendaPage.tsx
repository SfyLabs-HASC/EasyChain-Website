import React, { useState, useEffect, useRef } from 'react';
import { Link, HashRouter } from 'react-router-dom';
import { ConnectButton, useActiveAccount, useReadContract, useSendTransaction, ThirdwebProvider } from 'thirdweb/react';
import { createThirdwebClient, getContract, prepareContractCall } from 'thirdweb';
import { polygon } from 'thirdweb/chains';
import { inAppWallet } from 'thirdweb/wallets';
import { keccak256, toHex, pad } from 'thirdweb/utils';

// --- ABI del contratto (incluso per completezza) ---
const supplyChainABI = [
  {
    "type": "function",
    "name": "getContributorInfo",
    "inputs": [
      {
        "type": "address",
        "name": "",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "type": "string",
        "name": "",
        "internalType": "string"
      },
      {
        "type": "uint256",
        "name": "",
        "internalType": "uint256"
      },
      {
        "type": "bool",
        "name": "",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getBatchStepCount",
    "inputs": [
      {
        "type": "uint256",
        "name": "_batchId",
        "internalType": "uint256"
      }
    ],
    "outputs": [
      {
        "type": "uint256",
        "name": "",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "initializeBatch",
    "inputs": [
      {
        "type": "string",
        "name": "_name",
        "internalType": "string"
      },
      {
        "type": "string",
        "name": "_description",
        "internalType": "string"
      },
      {
        "type": "string",
        "name": "_date",
        "internalType": "string"
      },
      {
        "type": "string",
        "name": "_location",
        "internalType": "string"
      },
      {
        "type": "string",
        "name": "_imageIpfsHash",
        "internalType": "string"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "event",
    "name": "BatchInitialized",
    "inputs": [
      {
        "type": "address",
        "name": "contributor",
        "indexed": true,
        "internalType": "address"
      },
      {
        "type": "uint256",
        "name": "batchId",
        "indexed": true,
        "internalType": "uint256"
      },
      {
        "type": "string",
        "name": "name",
        "indexed": false,
        "internalType": "string"
      },
      {
        "type": "string",
        "name": "description",
        "indexed": false,
        "internalType": "string"
      },
      {
        "type": "string",
        "name": "date",
        "indexed": false,
        "internalType": "string"
      },
      {
        "type": "string",
        "name": "location",
        "indexed": false,
        "internalType": "string"
      },
      {
        "type": "string",
        "name": "imageIpfsHash",
        "indexed": false,
        "internalType": "string"
      },
      {
        "type": "string",
        "name": "contributorName",
        "indexed": false,
        "internalType": "string"
      },
      {
        "type": "bool",
        "name": "isClosed",
        "indexed": false,
        "internalType": "bool"
      }
    ],
    "anonymous": false
  }
];

// --- Componente per lo status della transazione ---
const TransactionStatusModal = ({ status, message, onClose }: { status: 'loading' | 'success' | 'error', message: string, onClose: () => void }) => (
    <div className="modal-overlay">
        <div className="modal-content" style={{ maxWidth: '400px', textAlign: 'center' }}>
            <div className="modal-header">
                <h2>{status === 'loading' ? 'In corso...' : status === 'success' ? 'Successo!' : 'Errore'}</h2>
            </div>
            <div className="modal-body">
                <p>{message}</p>
            </div>
            <div className="modal-footer">
                {status !== 'loading' && <button onClick={onClose} className="web3-button">Chiudi</button>}
            </div>
        </div>
    </div>
);


// --- Stili CSS ---
const AziendaPageStyles = () => (
  <style>{`
    :root {
        --primary-color: #3498db;
        --secondary-color: #2c3e50;
        --background-color: #1c1c1c;
        --card-bg-color: #2a2a2a;
        --text-color: #ecf0f1;
        --border-color: #444;
    }
    body {
        background-color: var(--background-color);
        color: var(--text-color);
        font-family: 'Inter', sans-serif;
    }
    .app-container-full { 
        padding: 0 2rem; 
        max-width: 1200px;
        margin: 0 auto;
    }
    .main-header-bar { 
        display: flex; 
        justify-content: space-between; 
        align-items: center; 
        padding: 1rem 0;
        border-bottom: 1px solid var(--border-color);
        margin-bottom: 2rem;
    }
    .header-title { 
        font-size: 1.75rem; 
        font-weight: bold; 
    }
    .dashboard-header-card { 
        display: flex; 
        justify-content: space-between; 
        align-items: center; 
        position: relative; 
        padding: 1.5rem; 
        background-color: #212529; 
        border: 1px solid #495057; 
        border-radius: 12px; 
        margin-bottom: 2rem; 
    }
    .dashboard-header-info { 
        display: flex; 
        flex-direction: column; 
    }
    .company-name-header { 
        margin-top: 0; 
        margin-bottom: 1rem; 
        font-size: 3rem; 
    }
    .company-status-container { 
        display: flex; 
        align-items: center; 
        gap: 1.5rem; 
    }
    .status-item { 
        display: flex; 
        align-items: center; 
        gap: 0.5rem; 
    }
    .web3-button {
        background-color: var(--primary-color);
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 8px;
        cursor: pointer;
        font-weight: bold;
        transition: background-color 0.3s ease;
        text-decoration: none;
        display: inline-block;
        text-align: center;
    }
    .web3-button:hover {
        background-color: #2980b9;
    }
    .web3-button.large { 
        padding: 1rem 2rem; 
        font-size: 1.1rem; 
    }
    .web3-button.secondary {
        background-color: #6c757d;
    }
    .web3-button:disabled {
        background-color: #555;
        cursor: not-allowed;
    }
    .company-table {
        width: 100%;
        border-collapse: collapse;
    }
    .company-table th, .company-table td {
        padding: 12px 15px;
        text-align: left;
        border-bottom: 1px solid var(--border-color);
    }
    .company-table th {
        background-color: var(--secondary-color);
    }
    .company-table .desktop-row { display: table-row; }
    .company-table .mobile-card { display: none; }
    .pagination-controls { 
        display: flex; 
        justify-content: space-between; 
        align-items: center; 
        margin-top: 1rem; 
    }
    .recap-summary { 
        text-align: left; 
        padding: 15px; 
        background-color: var(--card-bg-color); 
        border: 1px solid var(--border-color); 
        border-radius: 8px; 
        margin-bottom: 20px;
    }
    .recap-summary p { margin: 8px 0; word-break: break-word; }
    .recap-summary p strong { color: #f8f9fa; }
    .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(0, 0, 0, 0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    }
    .modal-content {
        background-color: var(--card-bg-color);
        padding: 2rem;
        border-radius: 12px;
        width: 90%;
        max-width: 600px;
        border: 1px solid var(--border-color);
    }
    .modal-header {
        border-bottom: 1px solid var(--border-color);
        padding-bottom: 1rem;
        margin-bottom: 1rem;
    }
    .modal-footer {
        border-top: 1px solid var(--border-color);
        padding-top: 1rem;
        margin-top: 1rem;
        display: flex;
        justify-content: flex-end;
        gap: 1rem;
    }
    .filter-input {
        width: 100%;
        padding: 8px;
        border-radius: 6px;
        border: 1px solid #555;
        background-color: #333;
        color: white;
    }
    .clickable-name {
        cursor: pointer;
        color: var(--primary-color);
        font-weight: bold;
    }
    .status-closed { color: #2ecc71; }
    .status-open { color: #f39c12; }
    .login-container {
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100vh;
    }
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
        .mobile-card { display: block; border: 1px solid #495057; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; background-color: var(--secondary-color); }
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

const RegistrationForm = () => ( <div className="card" style={{textAlign: 'center', padding: '2rem', backgroundColor: 'var(--card-bg-color)', borderRadius: '12px'}}><h3>Benvenuto su Easy Chain!</h3><p>Il tuo account non è ancora attivo. Compila il form di registrazione per inviare una richiesta di attivazione.</p></div> );

interface BatchData { id: string; batchId: bigint; name: string; description: string; date: string; location: string; imageIpfsHash: string; contributorName: string; isClosed: boolean; }

const BatchRow = ({ batch, localId }: { batch: BatchData; localId: number }) => {
    const [showDescription, setShowDescription] = useState(false);
    const { data: stepCount } = useReadContract({ contract, abi: supplyChainABI, method: "getBatchStepCount", params: [batch.batchId] });
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
                    <div className="card-header"><strong className="clickable-name" onClick={() => setShowDescription(true)}>{batch.name || 'N/A'}</strong><span className={batch.isClosed ? 'status-closed' : 'status-open'}>{batch.isClosed ? '✅ Chiuso' : '⏳ Aperto'}</span></div>
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
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsToShow, setItemsToShow] = useState(10);
    const MAX_PER_PAGE = 30;
    const totalPages = Math.max(1, Math.ceil(batches.length / MAX_PER_PAGE));
    const startIndex = (currentPage - 1) * MAX_PER_PAGE;
    const itemsOnCurrentPage = batches.slice(startIndex, startIndex + MAX_PER_PAGE);
    const visibleBatches = itemsOnCurrentPage.slice(0, itemsToShow);

    useEffect(() => {
        setCurrentPage(1);
        setItemsToShow(10);
    }, [batches, nameFilter, locationFilter, statusFilter]);

    const handleLoadMore = () => setItemsToShow(prev => Math.min(prev + 10, MAX_PER_PAGE));
    const handlePageChange = (page: number) => {
        if (page < 1 || page > totalPages) return;
        setCurrentPage(page);
        setItemsToShow(10);
    };

    return (
        <div className="table-container">
            <table className="company-table">
                <thead>
                    <tr className="desktop-row"><th>ID</th><th>Nome</th><th>Data</th><th>Luogo</th><th>N° Passaggi</th><th>Stato</th><th>Azione</th></tr>
                    <tr className="filter-row"><th></th><th><input type="text" placeholder="Filtra per nome..." className="filter-input" value={nameFilter} onChange={(e) => setNameFilter(e.target.value)} /></th><th></th><th><input type="text" placeholder="Filtra per luogo..." className="filter-input" value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} /></th><th></th><th><select className="filter-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="all">Tutti</option><option value="open">Aperto</option><option value="closed">Chiuso</option></select></th><th></th></tr>
                </thead>
                <tbody>{visibleBatches.length > 0 ? (visibleBatches.map((batch: BatchData, index: number) => <BatchRow key={batch.id} batch={batch} localId={startIndex + index + 1} />)) : (<tr><td colSpan={7} style={{textAlign: 'center', padding: '2rem'}}>Nessuna iscrizione trovata.</td></tr>)}</tbody>
            </table>
            <div className="pagination-controls">
                {itemsToShow < itemsOnCurrentPage.length && (<button onClick={handleLoadMore} className='web3-button secondary'>Vedi altri 10...</button>)}
                <div className="page-selector">
                    {totalPages > 1 && <> <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="web3-button secondary">&lt;</button> <span> Pagina {currentPage} di {totalPages} </span> <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="web3-button secondary">&gt;</button></>}
                </div>
            </div>
        </div>
    );
};

const DashboardHeader = ({ contributorInfo, onNewInscriptionClick }: { contributorInfo: readonly [string, bigint, boolean], onNewInscriptionClick: () => void }) => {
    const companyName = contributorInfo[0] || 'Azienda';
    const credits = contributorInfo[1].toString();
    return (
        <div className="dashboard-header-card">
            <div className="dashboard-header-info">
                <h2 className="company-name-header">{companyName}</h2>
                <div className="company-status-container">
                    <div className="status-item"><span>Crediti Rimanenti: <strong>{credits}</strong></span></div>
                    <div className="status-item"><span>Stato: <strong>ATTIVO</strong></span><span className="status-icon">✅</span></div>
                </div>
            </div>
            <div className="header-actions"><button className="web3-button large" onClick={onNewInscriptionClick}>Nuova Iscrizione</button></div>
        </div>
    );
};

const getInitialFormData = () => ({ name: "", description: "", date: "", location: "" });

const AziendaPage = () => {
    const account = useActiveAccount();
    
    const { data: contributorData, isLoading: isStatusLoading, refetch: refetchContributorInfo, isError } = useReadContract({ 
        contract, 
        abi: supplyChainABI,
        method: "getContributorInfo", 
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

        const insightBaseUrl = 'https://137.insight.thirdweb.com';
        const contractAddress = '0x2Bd72307a73cC7BE3f275a81c8eDBE775bB08F3E';
        const eventSignature = 'BatchInitialized(address,uint256,string,string,string,string,string,string,bool)';
        const eventTopic0 = keccak256(toHex(eventSignature));
        const eventTopic1 = pad(account.address as `0x${string}`, { size: 32 });

        const url = new URL(`${insightBaseUrl}/v1/events`);
        url.searchParams.append('filter_address', contractAddress);
        url.searchParams.append('filter_topic_0', eventTopic0);
        url.searchParams.append('filter_topic_1', eventTopic1);
        url.searchParams.append('decode', 'true');
        url.searchParams.append('sort_order', 'desc');

        try {
            const response = await fetch(url.toString(), {
                headers: {
                    'x-client-id': 'eda8282e23ee12f17d8d1d20ef8aaa83',
                }
            });

            if (!response.ok) {
                if (response.status === 404) {
                    setAllBatches([]);
                    return;
                }
                const errorData = await response.json();
                throw new Error(errorData.error?.message || `Errore da Insight API: ${response.statusText}`);
            }
            
            const result = await response.json();
            const events = result.data || [];
            
            const formattedBatches = events.map((event: any) => {
                const args = { ...event.decoded.indexed_params, ...event.decoded.non_indexed_params };
                return {
                    id: args.batchId.toString(),
                    batchId: BigInt(args.batchId),
                    name: args.name,
                    description: args.description,
                    date: args.date,
                    location: args.location,
                    imageIpfsHash: args.imageIpfsHash,
                    contributorName: args.contributorName,
                    isClosed: args.isClosed,
                };
            });
            
            setAllBatches(formattedBatches);
        } catch (error) {
            console.error("Errore nel caricare le iscrizioni da Insight (REST API):", error);
            setAllBatches([]);
        } finally {
            setIsLoadingBatches(false);
        }
    };

    useEffect(() => {
        if (account?.address && prevAccountRef.current !== account.address) { 
            refetchContributorInfo(); 
            fetchAllBatches(); 
        } else if (account?.address && !prevAccountRef.current) { 
            fetchAllBatches(); 
        }
        prevAccountRef.current = account?.address;
    }, [account, refetchContributorInfo]);

    useEffect(() => {
        let tempBatches = [...allBatches];
        if (nameFilter) tempBatches = tempBatches.filter(b => b.name.toLowerCase().includes(nameFilter.toLowerCase()));
        if (locationFilter) tempBatches = tempBatches.filter(b => b.location.toLowerCase().includes(locationFilter.toLowerCase()));
        if (statusFilter !== 'all') { 
            const isOpen = statusFilter === 'open'; 
            tempBatches = tempBatches.filter(b => !b.isClosed === isOpen); 
        }
        setFilteredBatches(tempBatches);
    }, [nameFilter, locationFilter, statusFilter, allBatches]);
    
    const handleModalInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { setFormData(prev => ({...prev, [e.target.name]: e.target.value})); };
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { setSelectedFile(e.target.files?.[0] || null); };
    
    const handleInitializeBatch = async () => {
        if (!formData.name.trim()) { setTxResult({ status: 'error', message: 'Il campo Nome è obbligatorio.' }); return; }
        setLoadingMessage('Preparazione transazione...');
        let imageIpfsHash = "N/A";
        if (selectedFile) {
            // ... logica upload file
        }
        setLoadingMessage('Transazione in corso...');
        const transaction = prepareContractCall({ 
            contract, 
            abi: supplyChainABI, 
            method: "initializeBatch", 
            params: [formData.name, formData.description, formData.date, formData.location, imageIpfsHash] 
        });
        sendTransaction(transaction, { 
            onSuccess: () => { 
                setTxResult({ status: 'success', message: 'Iscrizione creata con successo!' }); 
                setLoadingMessage(''); 
                setTimeout(() => {
                    fetchAllBatches();
                    refetchContributorInfo();
                }, 4000);
            },
            onError: (err) => { 
                console.error("Dettagli errore transazione:", err);
                const errorMessage = err.message.toLowerCase();
                let displayMessage = "Errore generico nella transazione.";
                if (errorMessage.includes("insufficient funds") || errorMessage.includes("contributor has no credits")) {
                    displayMessage = "Crediti insufficienti. Contatta l'amministratore.";
                } else if (errorMessage.includes("not an active contributor")) {
                    displayMessage = "Il tuo account non risulta essere un contributor attivo.";
                } else {
                    const reasonMatch = err.message.match(/reason="([^"]+)"/);
                    if (reasonMatch && reasonMatch[1]) displayMessage = `Errore: ${reasonMatch[1]}`;
                }
                setTxResult({ status: 'error', message: displayMessage });
                setLoadingMessage(''); 
            } 
        });
    };
    
    const openModal = () => { setFormData(getInitialFormData()); setSelectedFile(null); setCurrentStep(1); setTxResult(null); setModal('init'); }
    const handleCloseModal = () => setModal(null);
    
    if (!account) { 
        return (
            <div className='login-container'>
                <AziendaPageStyles />
                <ConnectButton 
                    client={client} 
                    chain={polygon} 
                    accountAbstraction={{ chain: polygon, sponsorGas: true }} 
                    wallets={[inAppWallet()]} 
                    connectButton={{ label: "Connettiti / Log In", style: { fontSize: '1.2rem', padding: '1rem 2rem' } }} 
                />
            </div>
        ); 
    }
    
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

    return (
        <div className="app-container-full">
            <AziendaPageStyles />
            <header className="main-header-bar">
                <div className="header-title">EasyChain - Area Riservata</div>
                <div className="wallet-button-container">
                    <ConnectButton client={client} chain={polygon} detailsModal={{ hideSend: true, hideReceive: true, hideBuy: true, hideTransactionHistory: true }}/>
                </div>
            </header>
            <main className="main-content-full">{renderDashboardContent()}</main>
            
            {modal === 'init' && ( 
                <div className="modal-overlay" onClick={handleCloseModal}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header"><h2>Nuova Iscrizione</h2></div>
                        <div className="modal-body" style={{ minHeight: '350px' }}>
                           <p>Contenuto del modale per la creazione di una nuova iscrizione.</p>
                        </div>
                        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
                           <button onClick={handleCloseModal} className="web3-button secondary">Annulla</button>
                           <button onClick={handleInitializeBatch} className="web3-button">Crea</button>
                        </div>
                    </div>
                </div> 
            )}
            
            {isProcessing && <TransactionStatusModal status={'loading'} message={loadingMessage} onClose={() => {}} />}
            {txResult && <TransactionStatusModal status={txResult.status} message={txResult.message} onClose={() => { if (txResult.status === 'success') handleCloseModal(); setTxResult(null); }} />}
        </div>
    );
}

// Componente principale che wrappa l'applicazione
export default function App() {
    return (
        <ThirdwebProvider>
            <HashRouter>
                <AziendaPage />
            </HashRouter>
        </ThirdwebProvider>
    );
}
