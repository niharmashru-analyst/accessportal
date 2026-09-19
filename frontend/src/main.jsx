import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Eye, EyeOff, LogOut, Plus, Pencil, Trash2, LayoutDashboard,
  Users, ShieldCheck, Search, X, RefreshCw, ExternalLink
} from "lucide-react";
import "./styles.css";

const api = async (url, options={}) => {
  const res = await fetch(url, {
    credentials: "include",
    headers: {"Content-Type":"application/json", ...(options.headers||{})},
    ...options
  });
  const data = await res.json().catch(()=>({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
};

function App(){
  const [user,setUser] = useState(null);
  const [destinations,setDestinations] = useState([]);
  const [loading,setLoading] = useState(true);
  const [page,setPage] = useState("home");
  const [error,setError] = useState("");

  useEffect(()=>{
    api("/api/me").then(d=>{
      setUser(d.user); setDestinations(d.destinations);
    }).catch(()=>{}).finally(()=>setLoading(false));
  },[]);

  const logout = async()=>{
    await api("/api/logout",{method:"POST"});
    setUser(null); setDestinations([]); setPage("home");
  };

  if(loading) return <Splash/>;

  if(!user) return <Login onLogin={(d)=>{
    setUser(d.user); setDestinations(d.destinations);
  }}/>;

  if(user.is_admin && page==="admin")
    return <Admin user={user} onBack={()=>setPage("home")} />;

  return <Home
    user={user}
    destinations={destinations}
    onLogout={logout}
    onAdmin={()=>setPage("admin")}
  />;
}

function Splash(){
  return <div className="splash"><div className="brand-mark">R</div><div>RENEE ANALYTICS</div></div>
}

function Login({onLogin}){
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [show,setShow]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");

  const submit=async(e)=>{
    e.preventDefault(); setError(""); setBusy(true);
    try{
      const d=await api("/api/login",{method:"POST",body:JSON.stringify({email,password})});
      onLogin(d);
    }catch(err){setError(err.message)}
    finally{setBusy(false)}
  };

  return <div className="auth-shell">
    <div className="auth-card">
      <div className="brand-mark large">R</div>
      <div className="eyebrow">RENEE ANALYTICS</div>
      <h1>Dashboard Access</h1>
      <p className="muted">Sign in to access your dashboards.</p>
      <form onSubmit={submit}>
        <label>Email</label>
        <input value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="Enter your email" autoComplete="username" required/>
        <label>Password</label>
        <div className="password-wrap">
          <input value={password} onChange={e=>setPassword(e.target.value)} type={show?"text":"password"} placeholder="Enter your password" autoComplete="current-password" required/>
          <button type="button" className="eye" onClick={()=>setShow(!show)}>{show?<EyeOff size={18}/>:<Eye size={18}/>}</button>
        </div>
        {error && <div className="error">{error}</div>}
        <button className="primary full" disabled={busy}>{busy?"Signing in...":"SIGN IN"}</button>
      </form>
    </div>
  </div>
}

function Home({user,destinations,onLogout,onAdmin}){
  return <div className="app-shell">
    <header className="topbar">
      <div className="logo"><span>R</span> RENEE ANALYTICS</div>
      <div className="top-actions">
        <div className="user-chip">
          <div className="avatar">{user.name?.[0]?.toUpperCase()}</div>
          <div><strong>{user.name}</strong><small>{user.designation}</small></div>
        </div>
        {user.is_admin && <button className="icon-btn" onClick={onAdmin} title="Admin"><ShieldCheck size={18}/></button>}
        <button className="icon-btn" onClick={onLogout} title="Logout"><LogOut size={18}/></button>
      </div>
    </header>

    <main className="main">
      <div className="welcome">
        <div>
          <div className="eyebrow">WELCOME BACK</div>
          <h2>{user.name}</h2>
          <p className="muted">Choose a dashboard to continue.</p>
        </div>
      </div>

      {destinations.length===0 ? <div className="empty">No dashboard access has been assigned to your account.</div> :
      <div className="dashboard-grid">
        {destinations.map(d=><DashboardCard key={d.key} d={d}/>)}
      </div>}
    </main>
  </div>
}

function DashboardCard({d}){
  const isEka=d.key==="eka";
  return <div className="dash-card">
    <div className={"dash-icon "+(isEka?"eka":"mt")}>{isEka?"E":"MT"}</div>
    <div className="dash-info">
      <span className="tag">{isEka?"EKA":"MODERN TRADE"}</span>
      <h3>{d.name}</h3>
      <p>{isEka?"EKA channel analytics dashboard":"Modern Trade 360 analytics dashboard"}</p>
    </div>
    <a className="open-btn" href={d.url} target="_blank" rel="noreferrer">OPEN <ExternalLink size={15}/></a>
  </div>
}

function Admin({user,onBack}){
  const [users,setUsers]=useState([]);
  const [logs,setLogs]=useState([]);
  const [modal,setModal]=useState(null);
  const [search,setSearch]=useState("");
  const [error,setError]=useState("");
  const load=async()=>{
    try{
      const [u,l]=await Promise.all([api("/api/users"),api("/api/audit")]);
      setUsers(u.users);setLogs(l.logs);
    }catch(e){setError(e.message)}
  };
  useEffect(()=>{load()},[]);
  const filtered=users.filter(u=>
    `${u.name} ${u.email} ${u.designation}`.toLowerCase().includes(search.toLowerCase())
  );

  return <div className="admin-shell">
    <header className="topbar">
      <div className="logo"><span>R</span> ADMIN CONSOLE</div>
      <div className="top-actions">
        <button className="secondary" onClick={onBack}><LayoutDashboard size={16}/> Dashboard</button>
        <button className="icon-btn" onClick={load} title="Refresh"><RefreshCw size={18}/></button>
      </div>
    </header>
    <main className="main">
      <div className="admin-head">
        <div><div className="eyebrow">ACCESS MANAGEMENT</div><h2>Users</h2><p className="muted">Manage dashboard access and credentials.</p></div>
        <button className="primary" onClick={()=>setModal({})}><Plus size={18}/> ADD USER</button>
      </div>

      <div className="stats">
        <Stat label="TOTAL USERS" value={users.length}/>
        <Stat label="ACTIVE USERS" value={users.filter(u=>u.active).length}/>
        <Stat label="EKA ACCESS" value={users.filter(u=>u.eka_access).length}/>
        <Stat label="MT ACCESS" value={users.filter(u=>u.mt_access).length}/>
      </div>

      <div className="toolbar">
        <div className="search"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search users..."/></div>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="table-wrap">
        <table>
          <thead><tr><th>USER</th><th>DESIGNATION</th><th>ACCESS</th><th>ROLE</th><th>STATUS</th><th>ACTION</th></tr></thead>
          <tbody>
          {filtered.map(u=><tr key={u.id}>
            <td><div className="person"><div className="avatar">{u.name?.[0]?.toUpperCase()}</div><div><strong>{u.name}</strong><small>{u.email}</small></div></div></td>
            <td>{u.designation || "—"}</td>
            <td><div className="access-pills">{u.eka_access&&<span>EKA</span>}{u.mt_access&&<span>MT</span>}{!u.eka_access&&!u.mt_access&&<em>None</em>}</div></td>
            <td>{u.is_admin?<span className="role-admin">ADMIN</span>:"USER"}</td>
            <td><span className={u.active?"status active":"status"}>{u.active?"Active":"Disabled"}</span></td>
            <td><div className="row-actions">
              <button className="small-icon" onClick={()=>setModal(u)}><Pencil size={16}/></button>
              <button className="small-icon danger" disabled={u.id===user.id} onClick={async()=>{
                if(confirm(`Delete ${u.email}?`)){try{await api(`/api/users/${u.id}`,{method:"DELETE"});load()}catch(e){alert(e.message)}}
              }}><Trash2 size={16}/></button>
            </div></td>
          </tr>)}
          </tbody>
        </table>
      </div>

      <div className="audit">
        <h3>Recent Activity</h3>
        {logs.slice(0,8).map(l=><div className="audit-row" key={l.id}><span>{l.action.replaceAll("_"," ")}</span><span>{l.target_email}</span><small>{l.created_at}</small></div>)}
      </div>
    </main>
    {modal!==null && <UserModal user={modal.id?modal:null} close={()=>setModal(null)} saved={()=>{setModal(null);load()}}/>}
  </div>
}

function Stat({label,value}){return <div className="stat"><span>{label}</span><strong>{value}</strong></div>}

function UserModal({user,close,saved}){
  const [form,setForm]=useState({
    name:user?.name||"",email:user?.email||"",designation:user?.designation||"",
    password:"",eka_access:user?.eka_access||false,mt_access:user?.mt_access||false,
    is_admin:user?.is_admin||false,active:user?.active??true
  });
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const submit=async e=>{
    e.preventDefault();setError("");setBusy(true);
    try{
      await api(user?`/api/users/${user.id}`:"/api/users",{
        method:user?"PUT":"POST",body:JSON.stringify(form)
      });saved();
    }catch(e){setError(e.message)}finally{setBusy(false)}
  };
  return <div className="modal-bg" onMouseDown={e=>e.target===e.currentTarget&&close()}>
    <div className="modal">
      <div className="modal-head"><div><div className="eyebrow">{user?"EDIT USER":"NEW USER"}</div><h3>{user?"Edit User":"Add User"}</h3></div><button className="icon-btn" onClick={close}><X/></button></div>
      <form onSubmit={submit}>
        <div className="two"><Field label="Name" value={form.name} onChange={v=>set("name",v)} required/><Field label="Email" type="email" value={form.email} onChange={v=>set("email",v)} required/></div>
        <Field label="Designation" value={form.designation} onChange={v=>set("designation",v)} required/>
        <Field label={user?"New Password (leave blank to keep current)":"Password"} type="password" value={form.password} onChange={v=>set("password",v)} required={!user}/>
        <label className="section-label">Dashboard Access</label>
        <div className="checks">
          <Check label="EKA Analytics" checked={form.eka_access} onChange={v=>set("eka_access",v)}/>
          <Check label="Modern Trade 360" checked={form.mt_access} onChange={v=>set("mt_access",v)}/>
        </div>
        <label className="section-label">Account</label>
        <div className="checks">
          <Check label="Admin access" checked={form.is_admin} onChange={v=>set("is_admin",v)}/>
          <Check label="Active user" checked={form.active} onChange={v=>set("active",v)}/>
        </div>
        {error&&<div className="error">{error}</div>}
        <div className="modal-actions"><button type="button" className="secondary" onClick={close}>CANCEL</button><button className="primary" disabled={busy}>{busy?"SAVING...":user?"SAVE CHANGES":"CREATE USER"}</button></div>
      </form>
    </div>
  </div>
}

function Field({label,value,onChange,type="text",required=false}){
  return <div className="field"><label>{label}</label><input type={type} value={value} onChange={e=>onChange(e.target.value)} required={required}/></div>
}
function Check({label,checked,onChange}){
  return <label className="check"><input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)}/><span>{label}</span></label>
}

createRoot(document.getElementById("root")).render(<App/>);
