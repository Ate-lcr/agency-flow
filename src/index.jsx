import React, { useState, useEffect, useMemo, createContext, useContext } from 'react';
import {
    LayoutDashboard, Clock, Calendar, FileText, Building2,
    LogOut, TrendingUp, Plus, Trash2, ChevronRight, SquarePen, X,
    List, Settings, ChevronLeft, Folder, Users, Search, Pin, AlertCircle, RefreshCcw
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, doc, collection, query, onSnapshot, setDoc, updateDoc, deleteDoc, addDoc, serverTimestamp, where } from 'firebase/firestore';
import './index.css'; 

// --- CONFIGURATION ---
// IMPORTANT : Ces variables lisent depuis le fichier .env (local) ou Vercel (prod)
const appId = import.meta.env.VITE_APP_ID || 'default-agency-app';
const firebaseConfig = import.meta.env.VITE_FIREBASE_CONFIG ? JSON.parse(import.meta.env.VITE_FIREBASE_CONFIG) : {};
const initialAuthToken = import.meta.env.VITE_AUTH_TOKEN || null;

// --- FIREBASE INIT ---
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Contextes
const AuthContext = createContext();
const DataContext = createContext();

// --- HOOKS PERSONNALISÉS ---

// 1. Hook d'Authentification
const useAuth = () => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
            } else {
                // Tentative de connexion anonyme par défaut
                try {
                    await signInAnonymously(auth);
                } catch (error) {
                    console.error("Erreur de connexion anonyme:", error);
                }
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const logout = () => signOut(auth);

    return { user, loading, logout };
};

// 2. Hook de Données Firestore
const useData = (userId) => {
    const [state, setState] = useState({
        tickets: [], requests: [], notes: [], projects: [], profiles: [], quotas: [],
        loading: true, error: null
    });

    const collections = useMemo(() => [
        'tickets', 'requests', 'notes', 'projects', 'profiles', 'quotas'
    ], []);

    useEffect(() => {
        if (!userId) return;

        const unsubscribers = [];
        let mounted = true;
        let loadedCollections = 0;

        collections.forEach(colName => {
            const path = `artifacts/${appId}/${colName}`;
            const q = query(collection(db, path));

            const unsubscribe = onSnapshot(q, (snapshot) => {
                if (!mounted) return;
                
                const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setState(prevState => ({
                    ...prevState,
                    [colName]: data,
                    loading: loadedCollections < collections.length - 1 // Maintenir le chargement tant que toutes ne sont pas reçues
                }));

                if (mounted && state.loading) {
                     loadedCollections++;
                    if (loadedCollections === collections.length) {
                        setState(prevState => ({ ...prevState, loading: false }));
                    }
                }
            }, (error) => {
                if (mounted) {
                    console.error(`Erreur de lecture ${colName}:`, error);
                    setState(prevState => ({ ...prevState, error: `Erreur de lecture ${colName}` }));
                }
            });

            unsubscribers.push(unsubscribe);
        });

        return () => {
            mounted = false;
            unsubscribers.forEach(unsub => unsub());
        };
    }, [userId, collections]);

    return { ...state };
};

// 3. Hook d'Actions
const useActions = (collectionName, userId) => {
    const path = `artifacts/${appId}/${collectionName}`;
    const colRef = collection(db, path);

    const add = async (data) => {
        try {
            await addDoc(colRef, {
                ...data,
                createdAt: serverTimestamp(),
                createdBy: userId,
            });
            return true;
        } catch (e) {
            console.error("Erreur d'ajout:", e);
            return false;
        }
    };

    const update = async (id, data) => {
        try {
            const docRef = doc(db, path, id);
            await updateDoc(docRef, {
                ...data,
                updatedAt: serverTimestamp(),
            });
            return true;
        } catch (e) {
            console.error("Erreur de mise à jour:", e);
            return false;
        }
    };

    const remove = async (id) => {
        try {
            const docRef = doc(db, path, id);
            await deleteDoc(docRef);
            return true;
        } catch (e) {
            console.error("Erreur de suppression:", e);
            return false;
        }
    };

    return { add, update, remove };
};

// --- COMPOSANTS D'AIDE ---

const Card = ({ children, title, icon: Icon, className = '' }) => (
    <div className={`bg-white rounded-xl shadow-lg p-6 ${className}`}>
        {title && (
            <div className="flex items-center mb-4">
                {Icon && <Icon className="w-5 h-5 mr-2 text-slate-500" />}
                <h3 className="text-lg font-semibold text-slate-700">{title}</h3>
            </div>
        )}
        {children}
    </div>
);

const Button = ({ children, onClick, variant = 'primary', icon: Icon, disabled = false, className = '' }) => {
    const baseStyle = "px-4 py-2 rounded-lg font-medium transition duration-150 ease-in-out flex items-center justify-center";
    let variantStyle = "";

    switch (variant) {
        case 'primary':
            variantStyle = "bg-[#03F1C5] text-slate-900 hover:bg-[#00D4AE]";
            break;
        case 'secondary':
            variantStyle = "bg-slate-100 text-slate-700 hover:bg-slate-200";
            break;
        case 'danger':
            variantStyle = "bg-red-500 text-white hover:bg-red-600";
            break;
        default:
            variantStyle = "bg-[#03F1C5] text-slate-900 hover:bg-[#00D4AE]";
    }

    if (disabled) {
        variantStyle = "bg-slate-300 text-slate-500 cursor-not-allowed";
    }

    return (
        <button
            className={`${baseStyle} ${variantStyle} ${className}`}
            onClick={onClick}
            disabled={disabled}
        >
            {Icon && <Icon className="w-5 h-5 mr-2" />}
            {children}
        </button>
    );
};


const Input = ({ label, type = 'text', value, onChange, placeholder, className = '' }) => (
    <div className={`mb-4 ${className}`}>
        {label && <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>}
        <input
            type={type}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-[#03F1C5]/70 transition duration-150"
        />
    </div>
);

// --- COMPOSANTS DES PAGES (Simplified Placeholders) ---

// Placeholder pour l'affichage de données
const DataList = ({ title, data, Icon }) => (
    <Card title={title} icon={Icon} className="mb-6">
        <ul className="space-y-3">
            {data.slice(0, 5).map(item => (
                <li key={item.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                    <span className="text-sm font-medium">{item.name || item.title || item.id}</span>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                </li>
            ))}
            {data.length === 0 && <p className="text-sm text-slate-500">Aucune donnée disponible.</p>}
        </ul>
    </Card>
);

const Dashboard = ({ tickets, requests, notes }) => (
    <div>
        <h1 className="text-3xl font-bold mb-8">Tableau de Bord</h1>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <DataList title="Tickets Actifs" data={tickets} Icon={List} />
            <DataList title="Demandes en Cours" data={requests} Icon={Calendar} />
            <DataList title="Notes Récentes" data={notes} Icon={FileText} />
        </div>
        <Card title="Statistiques Clés" icon={TrendingUp} className="mt-6">
            <p>Affichage des métriques principales...</p>
        </Card>
    </div>
);

const Timetracking = ({ projects }) => <h1 className="text-3xl font-bold">Suivi du Temps</h1>;
const Planning = ({ requests }) => <h1 className="text-3xl font-bold">Planification</h1>;
const Notes = ({ notes }) => <h1 className="text-3xl font-bold">Mes Notes</h1>;
const AgencyView = ({ tickets, requests, quotas }) => <h1 className="text-3xl font-bold">Vue Agence</h1>;
const AdminSettings = ({ projects, profiles }) => <h1 className="text-3xl font-bold">Paramètres Admin</h1>;


// --- COMPOSANT SIDEBAR ---

const NavItem = ({ icon: Icon, label, page, currentPage, setCurrentPage }) => (
    <li
        className={`flex items-center p-3 rounded-lg cursor-pointer transition duration-150 ease-in-out ${
            currentPage === page ? 'bg-[#03F1C5]/20 text-slate-900 font-semibold' : 'text-slate-500 hover:bg-slate-100'
        }`}
        onClick={() => setCurrentPage(page)}
    >
        <Icon className="w-5 h-5 mr-3" />
        <span className="text-sm">{label}</span>
    </li>
);

const Sidebar = ({ currentPage, setCurrentPage, user }) => {
    const { logout } = useContext(AuthContext);
    
    return (
        <aside className="w-72 fixed h-screen bg-white shadow-xl p-6 flex flex-col justify-between">
            <div>
                <div className="flex items-center mb-10">
                    <img src="https://via.placeholder.com/32" alt="Logo" className="w-8 h-8 mr-2" />
                    <h2 className="text-xl font-bold text-slate-800">AgencyFlow</h2>
                </div>
                <nav>
                    <ul className="space-y-2">
                        <NavItem icon={LayoutDashboard} label="Tableau de Bord" page="dashboard" currentPage={currentPage} setCurrentPage={setCurrentPage} />
                        <NavItem icon={Clock} label="Suivi du Temps" page="timetracking" currentPage={currentPage} setCurrentPage={setCurrentPage} />
                        <NavItem icon={Calendar} label="Planification" page="planning" currentPage={currentPage} setCurrentPage={setCurrentPage} />
                        <NavItem icon={FileText} label="Notes" page="notes" currentPage={currentPage} setCurrentPage={setCurrentPage} />
                        <NavItem icon={Building2} label="Vue Agence" page="agency" currentPage={currentPage} setCurrentPage={setCurrentPage} />
                        <hr className="my-4 border-slate-100" />
                        <NavItem icon={Settings} label="Admin / Projets" page="settings" currentPage={currentPage} setCurrentPage={setCurrentPage} />
                    </ul>
                </nav>
            </div>
            <div className="pt-4 border-t border-slate-100">
                 <div className="text-sm text-slate-600 mb-2">Utilisateur: {user?.uid.substring(0, 8)}...</div>
                 <Button onClick={logout} variant="secondary" icon={LogOut} className="w-full">
                    Déconnexion
                </Button>
            </div>
        </aside>
    );
};

// --- STYLES & FONTS ---
const FontsAndGlobalStyles = () => (
    <style>{`
        /* Importation des polices */
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Space+Grotesk:wght@500;700&display=swap');
        
        /* Styles globaux (basiques de Tailwind) */
        body { margin: 0; font-family: 'Inter', sans-serif; }
        h1, h2, h3 { font-family: 'Space Grotesk', sans-serif; }
    `}</style>
);


// --- COMPOSANT PRINCIPAL (App) ---

const App = () => {
    const [currentPage, setCurrentPage] = useState('dashboard');
    const { user, loading, logout } = useAuth();
    const { tickets, requests, notes, projects, profiles, quotas, loading: dataLoading, error: dataError } = useData(user?.uid);
    
    // Fournir le contexte d'authentification
    const authContextValue = useMemo(() => ({ user, loading, logout }), [user, loading, logout]);
    
    // Fournir le contexte de données (Optionnel si on passe les props directement)
    // const dataContextValue = useMemo(() => ({ tickets, requests, notes, projects, profiles, quotas }), [tickets, requests, notes, projects, profiles, quotas]);

    if (loading || dataLoading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-[#03F1C5] border-t-transparent rounded-full"></div></div>;
    if (dataError) return <div className="p-8 text-center font-sans text-red-600"><AlertCircle className="w-6 h-6 inline-block mr-2" />Erreur de chargement des données: {dataError}</div>;
    if (!user) return <div className="p-8 text-center font-sans">Connexion en cours...</div>;

    const renderPage = () => {
        switch (currentPage) {
            case 'dashboard': return <Dashboard tickets={tickets} requests={requests} notes={notes} userId={user.uid} />;
            case 'timetracking': return <Timetracking tickets={tickets} projects={projects} userId={user.uid} />;
            case 'planning': return <Planning requests={requests} userId={user.uid} />;
            case 'notes': return <Notes notes={notes} userId={user.uid} />;
            case 'agency': return <AgencyView tickets={tickets} requests={requests} quotas={quotas} />;
            case 'settings': return <AdminSettings projects={projects} profiles={profiles} />;
            default: return <Dashboard tickets={tickets} requests={requests} notes={notes} userId={user.uid} />;
        }
    };

    return (
        <AuthContext.Provider value={authContextValue}>
            <div className="min-h-screen bg-slate-50 flex font-sans text-slate-900">
                <FontsAndGlobalStyles />
                <Sidebar currentPage={currentPage} setCurrentPage={setCurrentPage} user={user} />
                <main className="flex-1 ml-72 overflow-y-auto h-screen">
                    <div className="p-8 max-w-7xl mx-auto">
                        {renderPage()}
                    </div>
                </main>
            </div>
        </AuthContext.Provider>
    );
};

export default App;
