<!DOCTYPE html>

<html className="dark" lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>Latexify Admin - User Management</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&amp;family=JetBrains+Mono:wght@400;500&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
</head>
<body className="overflow-hidden">
{/*  Sidebar  */}
<aside className="flex flex-col h-full p-4 gap-2 fixed docked h-screen w-64 left-0 top-0 dark:bg-surface-container border-r dark:border-outline-variant z-50" style={{ backgroundColor: "var(--color-admin-surface-container)", borderColor: "var(--color-admin-outline-variant)" }}>
<div className="flex items-center gap-3 px-2 mb-6">
<div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: "var(--color-admin-primary-container)" }}>
<span className="material-symbols-outlined" style={{ color: "var(--color-admin-on-primary-container)" }} style={{ fontVariationSettings: '\'FILL\' 1' }}>functions</span>
</div>
<div>
<h1 className="dark:text-primary leading-tight" style={{ color: "var(--color-admin-primary)" }}>Latexify</h1>
<p className="opacity-70" style={{ color: "var(--color-admin-on-surface-variant)" }}>Admin Console</p>
</div>
</div>
<nav className="flex flex-col gap-1 overflow-y-auto custom-scrollbar">
{/*  Navigation Items Mapping  */}
<a className="flex items-center gap-3 px-4 py-3 dark:text-on-surface-variant hover:bg-surface-container-highest dark:hover:bg-surface-container-highest transition-all" style={{ color: "var(--color-admin-on-surface)" }} href="#">
<span className="material-symbols-outlined" data-icon="dashboard">dashboard</span>
                Dashboard
            </a>
<a className="flex items-center gap-3 px-4 py-3 dark:text-on-surface-variant hover:bg-surface-container-highest dark:hover:bg-surface-container-highest transition-all" style={{ color: "var(--color-admin-on-surface)" }} href="#">
<span className="material-symbols-outlined" data-icon="payments">payments</span>
                Bill and Payments
            </a>
{/*  Active State: Users  */}
<a className="flex items-center gap-3 px-4 py-3 rounded-lg transition-all active: translate-x-1 duration-200" style={{ backgroundColor: "var(--color-admin-secondary-container)", color: "var(--color-admin-on-secondary-container)" }} href="#">
<span className="material-symbols-outlined" data-icon="group" style={{ fontVariationSettings: '\'FILL\' 1' }}>group</span>
                Users
            </a>
<a className="flex items-center gap-3 px-4 py-3 dark:text-on-surface-variant hover:bg-surface-container-highest dark:hover:bg-surface-container-highest transition-all" style={{ color: "var(--color-admin-on-surface)" }} href="#">
<span className="material-symbols-outlined" data-icon="settings">settings</span>
                Profile Setting
            </a>
<a className="flex items-center gap-3 px-4 py-3 dark:text-on-surface-variant hover:bg-surface-container-highest dark:hover:bg-surface-container-highest transition-all" style={{ color: "var(--color-admin-on-surface)" }} href="#">
<span className="material-symbols-outlined" data-icon="psychology">psychology</span>
                AI Analysis
            </a>
<a className="flex items-center gap-3 px-4 py-3 dark:text-on-surface-variant hover:bg-surface-container-highest dark:hover:bg-surface-container-highest transition-all" style={{ color: "var(--color-admin-on-surface)" }} href="#">
<span className="material-symbols-outlined" data-icon="help">help</span>
                Help and Support
            </a>
<a className="flex items-center gap-3 px-4 py-3 dark:text-on-surface-variant hover:bg-surface-container-highest dark:hover:bg-surface-container-highest transition-all" style={{ color: "var(--color-admin-on-surface)" }} href="#">
<span className="material-symbols-outlined" data-icon="local_offer">local_offer</span>
                Offers
            </a>
<a className="flex items-center gap-3 px-4 py-3 dark:text-on-surface-variant hover:bg-surface-container-highest dark:hover:bg-surface-container-highest transition-all" style={{ color: "var(--color-admin-on-surface)" }} href="#">
<span className="material-symbols-outlined" data-icon="chat">chat</span>
                Messaging &amp; Chat
            </a>
<a className="flex items-center gap-3 px-4 py-3 dark:text-on-surface-variant hover:bg-surface-container-highest dark:hover:bg-surface-container-highest transition-all" style={{ color: "var(--color-admin-on-surface)" }} href="#">
<span className="material-symbols-outlined" data-icon="calculate">calculate</span>
                Tax Calculation
            </a>
</nav>
<div className="mt-auto p-4 rounded-xl border" style={{ backgroundColor: "var(--color-admin-surface-container-low)", borderColor: "var(--color-admin-outline-variant)" }}>
<div className="flex items-center gap-3 mb-2">
<div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: "var(--color-admin-primary)" }}></div>
<span className="" style={{ color: "var(--color-admin-primary)" }}>System Online</span>
</div>
<p className="" style={{ color: "var(--color-admin-on-surface-variant)" }}>Version 4.2.0-stable</p>
</div>
</aside>
{/*  Main Content Area  */}
<main className="ml-64 flex flex-col min-h-screen">
{/*  Header  */}
<header className="flex justify-between items-center w-full px-6 py-stack-md dark:bg-surface border-b dark:border-outline-variant z-40" style={{ backgroundColor: "var(--color-admin-surface)", borderColor: "var(--color-admin-outline-variant)" }}>
<div className="flex items-center gap-4 flex-1">
<div className="relative w-full max-w-md">
<span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--color-admin-on-surface-variant)" }}>search</span>
<input className="w-full border rounded-lg pl-10 pr-4 py-2 focus:ring-2 focus:ring-primary-container focus:border-primary outline-none transition-all" style={{ backgroundColor: "var(--color-admin-surface-container-lowest)", borderColor: "var(--color-admin-outline-variant)" }} placeholder="Search users by name, email or ID..." type="text"/ />
</div>
</div>
<div className="flex items-center gap-4">
<button className="p-2 hover:bg-surface-container-high dark:hover:bg-surface-container-high rounded-full transition-colors active: opacity-80 scale-95" style={{ color: "var(--color-admin-on-surface-variant)" }}>
<span className="material-symbols-outlined" data-icon="notifications">notifications</span>
</button>
<button aria-label="Change Theme" className="p-2 hover:bg-surface-container-high dark:hover:bg-surface-container-high rounded-full transition-colors active:opacity-80 scale-95" style={{ color: "var(--color-admin-on-surface-variant)" }}>
<span className="material-symbols-outlined" data-icon="palette">palette</span>
</button><button className="p-2 hover:bg-surface-container-high dark:hover:bg-surface-container-high rounded-full transition-colors active: opacity-80 scale-95" style={{ color: "var(--color-admin-on-surface-variant)" }}>
<span className="material-symbols-outlined" data-icon="settings">settings</span>
</button>
<div className="h-8 w-px" style={{ backgroundColor: "var(--color-admin-outline-variant)" }}></div>
<div className="flex items-center gap-3 pl-2">
<div className="text-right">
<p className="" style={{ color: "var(--color-admin-on-surface)" }}>Admin Root</p>
<p className="" style={{ color: "var(--color-admin-on-surface-variant)" }}>Super Admin</p>
</div>
<img alt="Administrator Avatar" className="w-10 h-10 rounded-full border border-primary-container" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDTiFHuqWMoCY6xuJHoSiqmEjD4AsTxpWYKe1NaRg-evCCJU3br53CJSk5uVgBKnms4B4bfypj_MiBfhTuk1vuKIKGJ8DoRGM2owBMguEg_uRlzwRj4QrxgyXygD4vJ2QCClQRq0r7fo0PjQtuW2fzCiWoJ-TXPfGKHQeC-3tQtmrHBBe_pTe-5Kc9CDIbtUn0vgLg2G-7Ink-B2PzeReo9TYyq5kr7kAffZF-J7q13OYrj8BA9YUHLy55VDbjvhBS6rwBqgl9JjIg"/ />
</div>
</div>
</header>
{/*  Content Body  */}
<div className="p-8 overflow-y-auto max-h-[calc(100vh-73px)] custom-scrollbar">
{/*  Page Title & Quick Stats  */}
<div className="flex justify-between items-end mb-8">
<div>
<h2 className="mb-1" style={{ color: "var(--color-admin-on-surface)" }}>User Management</h2>
<p className="" style={{ color: "var(--color-admin-on-surface-variant)" }}>Oversee system participants, handle access controls, and analyze user health.</p>
</div>
<div className="flex gap-4">
<button className="flex items-center gap-2 border px-4 py-2 rounded-lg hover:bg-surface-container-highest transition-all" style={{ backgroundColor: "var(--color-admin-surface-container)", borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}>
<span className="material-symbols-outlined text-[20px]">file_download</span>
                        Export CSV
                    </button>
<button className="flex items-center gap-2 px-4 py-2 rounded-lg hover:opacity-90 transition-all" style={{ backgroundColor: "var(--color-admin-primary-container)", color: "var(--color-admin-on-primary-container)" }}>
<span className="material-symbols-outlined text-[20px]">person_add</span>
                        Provision User
                    </button>
</div>
</div>
{/*  Filters Bar  */}
<div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
<div className="border p-4 rounded-xl" style={{ backgroundColor: "var(--color-admin-surface-container)", borderColor: "var(--color-admin-outline-variant)" }}>
<p className="mb-2" style={{ color: "var(--color-admin-on-surface-variant)" }}>Membership Tier</p>
<select className="w-full border rounded-lg p-2 outline-none focus:ring-1 focus:ring-primary" style={{ backgroundColor: "var(--color-admin-surface-container-lowest)", borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}>
<option>All Tiers</option>
<option>Free Tier</option>
<option>Professional (Academic)</option>
<option>Enterprise (Institutional)</option>
</select>
</div>
<div className="border p-4 rounded-xl" style={{ backgroundColor: "var(--color-admin-surface-container)", borderColor: "var(--color-admin-outline-variant)" }}>
<p className="mb-2" style={{ color: "var(--color-admin-on-surface-variant)" }}>Account Status</p>
<select className="w-full border rounded-lg p-2 outline-none focus:ring-1 focus:ring-primary" style={{ backgroundColor: "var(--color-admin-surface-container-lowest)", borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}>
<option>Active / All</option>
<option>Pending Verification</option>
<option>Blacklisted / Banned</option>
<option>Inactive (90d+)</option>
</select>
</div>
<div className="border p-4 rounded-xl" style={{ backgroundColor: "var(--color-admin-surface-container)", borderColor: "var(--color-admin-outline-variant)" }}>
<p className="mb-2" style={{ color: "var(--color-admin-on-surface-variant)" }}>Behavior Monitoring</p>
<select className="w-full border rounded-lg p-2 outline-none focus:ring-1 focus:ring-primary" style={{ backgroundColor: "var(--color-admin-surface-container-lowest)", borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}>
<option>Normal Activity</option>
<option>Abnormal AI Usage</option>
<option>Multiple Login Conflict</option>
<option>High Refund Request Rate</option>
</select>
</div>
<div className="flex items-center justify-center border border-dashed p-4 rounded-xl cursor-pointer hover:bg-surface-container-highest transition-all group" style={{ backgroundColor: "var(--color-admin-surface-container-high)", borderColor: "var(--color-admin-primary)" }}>
<span className="material-symbols-outlined mr-2 group-hover:scale-110 transition-transform" style={{ color: "var(--color-admin-primary)" }}>filter_list_off</span>
<span className="" style={{ color: "var(--color-admin-primary)" }}>Reset All Filters</span>
</div>
</div>
<div className="flex gap-6">
{/*  Data Table Main  */}
<div className="flex-1 border rounded-xl overflow-hidden flex flex-col" style={{ backgroundColor: "var(--color-admin-surface-container)", borderColor: "var(--color-admin-outline-variant)" }}>
<div className="overflow-x-auto">
<table className="w-full text-left border-collapse">
<thead>
<tr className="border-b" style={{ backgroundColor: "var(--color-admin-surface-container-high)", borderColor: "var(--color-admin-outline-variant)" }}>
<th className="px-6 py-4 uppercase tracking-wider" style={{ color: "var(--color-admin-on-surface-variant)" }}>User Identity</th>
<th className="px-6 py-4 uppercase tracking-wider" style={{ color: "var(--color-admin-on-surface-variant)" }}>Membership</th>
<th className="px-6 py-4 uppercase tracking-wider text-center" style={{ color: "var(--color-admin-on-surface-variant)" }}>AI Usage</th>
<th className="px-6 py-4 uppercase tracking-wider text-center" style={{ color: "var(--color-admin-on-surface-variant)" }}>Projects</th>
<th className="px-6 py-4 uppercase tracking-wider" style={{ color: "var(--color-admin-on-surface-variant)" }}>Location</th>
<th className="px-6 py-4 uppercase tracking-wider" style={{ color: "var(--color-admin-on-surface-variant)" }}>Status</th>
<th className="px-6 py-4 uppercase tracking-wider text-right" style={{ color: "var(--color-admin-on-surface-variant)" }}>Actions</th>
</tr>
</thead>
<tbody className="divide-y divide-outline-variant">
{/*  User Row 1  */}
<tr className="hover:bg-surface-container-highest transition-colors cursor-pointer group">
<td className="px-6 py-4">
<div className="flex items-center gap-3">
<div className="w-10 h-10 rounded flex items-center justify-center" style={{ backgroundColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}>ED</div>
<div>
<p className="" style={{ color: "var(--color-admin-on-surface)" }}>Dr. Elena Dragan</p>
<p className="" style={{ color: "var(--color-admin-on-surface-variant)" }}>UID: LX-99021</p>
</div>
</div>
</td>
<td className="px-6 py-4">
<span className="px-2 py-1 rounded border" style={{ backgroundColor: "var(--color-admin-tertiary-container)", color: "var(--color-admin-on-tertiary-container)", borderColor: "rgba(255, 182, 149, 0.2)" }}>Professional</span>
</td>
<td className="px-6 py-4 text-center">
<p className="" style={{ color: "var(--color-admin-on-surface)" }}>1.2M tokens</p>
<div className="w-full h-1 rounded-full mt-2 overflow-hidden" style={{ backgroundColor: "var(--color-admin-surface-container-low)" }}>
<div className="h-full" style={{ backgroundColor: "var(--color-admin-primary)" }} style={{ width: '75%' }}></div>
</div>
</td>
<td className="px-6 py-4 text-center">
<span className="" style={{ color: "var(--color-admin-on-surface)" }}>42</span>
</td>
<td className="px-6 py-4">
<div className="flex items-center gap-1" style={{ color: "var(--color-admin-on-surface-variant)" }}>
<span className="material-symbols-outlined text-[16px]">location_on</span>
<span className="">Munich, DE</span>
</div>
</td>
<td className="px-6 py-4">
<div className="flex items-center gap-2" style={{ color: "#4ade80" }}>
<span className="w-2 h-2 rounded-full" style={{ backgroundColor: "#4ade80" }}></span>
<span className="">Active</span>
</div>
</td>
<td className="px-6 py-4 text-right">
<button className="p-2 hover:bg-primary-container/20 rounded-lg transition-all" style={{ color: "var(--color-admin-primary)" }}>
<span className="material-symbols-outlined">visibility</span>
</button>
</td>
</tr>
{/*  User Row 2 (Flagged)  */}
<tr className="hover:bg-error-container/10 transition-colors cursor-pointer group" style={{ backgroundColor: "rgba(255, 180, 171, 0.05)" }}>
<td className="px-6 py-4">
<div className="flex items-center gap-3">
<div className="w-10 h-10 rounded flex items-center justify-center" style={{ backgroundColor: "var(--color-admin-error-container)", color: "var(--color-admin-on-error-container)" }}>JK</div>
<div>
<p className="" style={{ color: "var(--color-admin-on-surface)" }}>Julian Kovic</p>
<p className="" style={{ color: "var(--color-admin-on-surface-variant)" }}>UID: LX-88231</p>
</div>
</div>
</td>
<td className="px-6 py-4">
<span className="px-2 py-1 rounded border" style={{ backgroundColor: "var(--color-admin-surface-container-highest)", color: "var(--color-admin-on-surface-variant)", borderColor: "var(--color-admin-outline-variant)" }}>Free</span>
</td>
<td className="px-6 py-4 text-center">
<p className="" style={{ color: "var(--color-admin-error)" }}>4.8M tokens</p>
<div className="w-full h-1 rounded-full mt-2 overflow-hidden" style={{ backgroundColor: "var(--color-admin-surface-container-low)" }}>
<div className="h-full" style={{ backgroundColor: "var(--color-admin-error)" }} style={{ width: '98%' }}></div>
</div>
</td>
<td className="px-6 py-4 text-center">
<span className="" style={{ color: "var(--color-admin-on-surface)" }}>156</span>
</td>
<td className="px-6 py-4">
<div className="flex items-center gap-1" style={{ color: "var(--color-admin-on-surface-variant)" }}>
<span className="material-symbols-outlined text-[16px]">location_on</span>
<span className="">Split, HR</span>
</div>
</td>
<td className="px-6 py-4">
<div className="flex items-center gap-2" style={{ color: "var(--color-admin-error)" }}>
<span className="w-2 h-2 rounded-full" style={{ backgroundColor: "var(--color-admin-error)" }}></span>
<span className="">Flagged</span>
</div>
</td>
<td className="px-6 py-4 text-right">
<button className="p-2 hover:bg-error-container/50 rounded-lg transition-all" style={{ color: "var(--color-admin-error)" }}>
<span className="material-symbols-outlined">warning</span>
</button>
</td>
</tr>
{/*  User Row 3  */}
<tr className="hover:bg-surface-container-highest transition-colors cursor-pointer group">
<td className="px-6 py-4">
<div className="flex items-center gap-3">
<div className="w-10 h-10 rounded flex items-center justify-center" style={{ backgroundColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}>AS</div>
<div>
<p className="" style={{ color: "var(--color-admin-on-surface)" }}>Amara Smith</p>
<p className="" style={{ color: "var(--color-admin-on-surface-variant)" }}>UID: LX-10292</p>
</div>
</div>
</td>
<td className="px-6 py-4">
<span className="px-2 py-1 rounded border" style={{ backgroundColor: "var(--color-admin-primary-container)", color: "var(--color-admin-on-primary-container)", borderColor: "rgba(195, 192, 255, 0.2)" }}>Enterprise</span>
</td>
<td className="px-6 py-4 text-center">
<p className="" style={{ color: "var(--color-admin-on-surface)" }}>250k tokens</p>
<div className="w-full h-1 rounded-full mt-2 overflow-hidden" style={{ backgroundColor: "var(--color-admin-surface-container-low)" }}>
<div className="h-full" style={{ backgroundColor: "var(--color-admin-primary)" }} style={{ width: '15%' }}></div>
</div>
</td>
<td className="px-6 py-4 text-center">
<span className="" style={{ color: "var(--color-admin-on-surface)" }}>8</span>
</td>
<td className="px-6 py-4">
<div className="flex items-center gap-1" style={{ color: "var(--color-admin-on-surface-variant)" }}>
<span className="material-symbols-outlined text-[16px]">location_on</span>
<span className="">London, UK</span>
</div>
</td>
<td className="px-6 py-4">
<div className="flex items-center gap-2" style={{ color: "#4ade80" }}>
<span className="w-2 h-2 rounded-full" style={{ backgroundColor: "#4ade80" }}></span>
<span className="">Active</span>
</div>
</td>
<td className="px-6 py-4 text-right">
<button className="p-2 hover:bg-primary-container/20 rounded-lg transition-all" style={{ color: "var(--color-admin-primary)" }}>
<span className="material-symbols-outlined">visibility</span>
</button>
</td>
</tr>
</tbody>
</table>
</div>
{/*  Pagination  */}
<div className="mt-auto border-t px-6 py-4 flex items-center justify-between" style={{ borderColor: "var(--color-admin-outline-variant)", backgroundColor: "var(--color-admin-surface-container-low)" }}>
<p className="" style={{ color: "var(--color-admin-on-surface-variant)" }}>Showing 1-25 of 1,204 users</p>
<div className="flex gap-2">
<button className="p-2 border rounded hover:bg-surface-container-high transition-colors" style={{ borderColor: "var(--color-admin-outline-variant)" }}>
<span className="material-symbols-outlined text-[18px]">chevron_left</span>
</button>
<button className="px-3 py-1 border rounded" style={{ borderColor: "var(--color-admin-primary)", backgroundColor: "var(--color-admin-primary-container)", color: "var(--color-admin-on-primary-container)" }}>1</button>
<button className="px-3 py-1 border rounded hover:bg-surface-container-high" style={{ borderColor: "var(--color-admin-outline-variant)" }}>2</button>
<button className="px-3 py-1 border rounded hover:bg-surface-container-high" style={{ borderColor: "var(--color-admin-outline-variant)" }}>3</button>
<button className="p-2 border rounded hover:bg-surface-container-high transition-colors" style={{ borderColor: "var(--color-admin-outline-variant)" }}>
<span className="material-symbols-outlined text-[18px]">chevron_right</span>
</button>
</div>
</div>
</div>
{/*  Detailed Insight Panel (Side Column)  */}
<aside className="w-96 flex flex-col gap-6">
{/*  Revenue Highlight Card  */}
<div className="border rounded-xl p-6 relative overflow-hidden group" style={{ backgroundColor: "var(--color-admin-surface-container)", borderColor: "var(--color-admin-outline-variant)" }}>
<div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
<span className="material-symbols-outlined text-[64px]" data-icon="payments">payments</span>
</div>
<p className="uppercase tracking-widest mb-2" style={{ color: "var(--color-admin-on-surface-variant)" }}>Selected User Health</p>
<div className="flex items-center justify-between mb-4">
<h3 className="" style={{ color: "var(--color-admin-on-surface)" }}>Julian Kovic</h3>
<span className="px-2 py-0.5 rounded border" style={{ color: "var(--color-admin-error)", backgroundColor: "rgba(255, 180, 171, 0.2)", borderColor: "rgba(255, 180, 171, 0.3)" }}>High Risk</span>
</div>
<div className="grid grid-cols-2 gap-4">
<div className="p-3 rounded-lg border" style={{ backgroundColor: "var(--color-admin-surface-container-low)", borderColor: "var(--color-admin-outline-variant)" }}>
<p className="" style={{ color: "var(--color-admin-on-surface-variant)" }}>Avg. Revenue</p>
<p className="" style={{ color: "var(--color-admin-primary)" }}>$42.50<span className="">/mo</span></p>
</div>
<div className="p-3 rounded-lg border" style={{ backgroundColor: "var(--color-admin-surface-container-low)", borderColor: "var(--color-admin-outline-variant)" }}>
<p className="" style={{ color: "var(--color-admin-on-surface-variant)" }}>LTV</p>
<p className="" style={{ color: "var(--color-admin-on-surface)" }}>$510.00</p>
</div>
</div>
</div>
{/*  Risk & Alerts Panel  */}
<div className="border rounded-xl p-6 flex-1" style={{ backgroundColor: "var(--color-admin-surface-container)", borderColor: "var(--color-admin-outline-variant)" }}>
<h4 className="flex items-center gap-2 mb-6 border-b pb-3" style={{ color: "var(--color-admin-on-surface)", borderColor: "var(--color-admin-outline-variant)" }}>
<span className="material-symbols-outlined" style={{ color: "var(--color-admin-error)" }} style={{ fontVariationSettings: '\'FILL\' 1' }}>report</span>
                            System Conflict Audit
                        </h4>
{/*  Conflict Item  */}
<div className="space-y-6">
<div className="flex gap-4">
<div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "rgba(255, 180, 171, 0.2)" }}>
<span className="material-symbols-outlined text-[18px]" style={{ color: "var(--color-admin-error)" }}>security</span>
</div>
<div>
<p className="" style={{ color: "var(--color-admin-on-surface)" }}>Multiple Sign-in Alert</p>
<p className="mb-1" style={{ color: "var(--color-admin-on-surface-variant)" }}>4 simultaneous sessions detected across 3 distinct regions (NY, Frankfurt, Zagreb).</p>
<span className="" style={{ color: "rgba(255, 180, 171, 0.8)" }}>Occurred: 2 hours ago</span>
</div>
</div>
<div className="flex gap-4">
<div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "rgba(49, 49, 192, 0.2)" }}>
<span className="material-symbols-outlined text-[18px]" style={{ color: "var(--color-admin-secondary)" }}>forum</span>
</div>
<div>
<p className="" style={{ color: "var(--color-admin-on-surface)" }}>Complaints Raised (2)</p>
<p className="mb-1" style={{ color: "var(--color-admin-on-surface-variant)" }}>Ticketing ID #8812 - AI rendering artifacting. Ticket ID #8845 - API Timeout issues.</p>
<span className="" style={{ color: "rgba(199, 196, 216, 0.8)" }}>Status: Investigating</span>
</div>
</div>
<div className="flex gap-4">
<div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "rgba(164, 65, 0, 0.2)" }}>
<span className="material-symbols-outlined text-[18px]" style={{ color: "var(--color-admin-tertiary)" }}>history</span>
</div>
<div>
<p className="" style={{ color: "var(--color-admin-on-surface)" }}>Refund History</p>
<p className="mb-1" style={{ color: "var(--color-admin-on-surface-variant)" }}>1 refund processed ($45.00) in March 2024. Reason: Billing error.</p>
<span className="" style={{ color: "var(--color-admin-tertiary)" }}>Refund Rate: Low (1%)</span>
</div>
</div>
</div>
<div className="mt-8 pt-6 border-t flex flex-col gap-3" style={{ borderColor: "var(--color-admin-outline-variant)" }}>
<button className="w-full py-3 rounded-lg hover:opacity-90 transition-all flex items-center justify-center gap-2" style={{ backgroundColor: "var(--color-admin-error)", color: "var(--color-admin-on-error)" }}>
<span className="material-symbols-outlined">block</span>
                                Blacklist User Account
                            </button>
<button className="w-full py-3 border rounded-lg hover:bg-surface-container-highest transition-all flex items-center justify-center gap-2" style={{ borderColor: "var(--color-admin-outline-variant)", color: "var(--color-admin-on-surface)" }}>
<span className="material-symbols-outlined">mail</span>
                                Send Compliance Notice
                            </button>
</div>
</div>
</aside>
</div>
{/*  Abnormal Activity Map Section  */}
<div className="mt-gutter grid grid-cols-1 md:grid-cols-3 gap-6 pb-stack-lg">
<div className="md:col-span-2 border rounded-xl overflow-hidden h-[300px] relative" style={{ backgroundColor: "var(--color-admin-surface-container)", borderColor: "var(--color-admin-outline-variant)" }}>
<div className="absolute top-4 left-4 z-10 backdrop-blur-md border p-3 rounded-lg" style={{ backgroundColor: "rgba(11, 19, 38, 0.8)", borderColor: "var(--color-admin-outline-variant)" }}>
<p className="uppercase mb-1" style={{ color: "var(--color-admin-on-surface-variant)" }}>Geographic Activity Cluster</p>
<p className="" style={{ color: "var(--color-admin-on-surface)" }}>Global User Dispersion</p>
</div>
<img className="w-full h-full object-cover opacity-60 grayscale hover:grayscale-0 transition-all duration-500" data-alt="A stylized high-tech world map in dark mode with glowing indigo and teal nodes representing user activity hotspots. The map is minimalist with subtle grid lines, appearing like a professional data visualization dashboard on a high-end monitor. Soft neon highlights accentuate major metropolitan areas, creating a mood of global scale and technical precision." src="https://lh3.googleusercontent.com/aida-public/AB6AXuAgx-Hd2gKr13aE4di9MX8xuwPwUSoH_pX9bbKhHwVjptIonvhyCSTigOTlOfV-PGK0iSAvcKpx1UxkVugPRm_YhmK0QM90eXDHacnK4qceSyhrnSC4wOX9lBm3vIhKFDMtNP3abiMiQKPiWyWe-AP8gNi30zJGTDcJl-1BSgVqjUxQj1Xc3NdPeUfMePDSQ76pC_RPpk3VwMoWMv07-QPp5-VqbyvfLaoqy1q715EG5kKzo6GBQDOn10WP_KRyW1zZpzHoirL84wA"/ />
<div className="absolute inset-0 bg-gradient-to-t from-background to-transparent pointer-events-none"></div>
</div>
<div className="border rounded-xl p-6 flex flex-col justify-center" style={{ backgroundColor: "var(--color-admin-surface-container)", borderColor: "var(--color-admin-outline-variant)" }}>
<div className="text-center">
<p className="mb-2" style={{ color: "var(--color-admin-primary)" }}>94.2%</p>
<p className="mb-1" style={{ color: "var(--color-admin-on-surface)" }}>User Health Score</p>
<p className="" style={{ color: "var(--color-admin-on-surface-variant)" }}>The overall system health remains stable. Only 0.4% of total user base is currently flagged for abnormal AI token extraction.</p>
</div>
<div className="mt-6 space-y-4">
<div className="flex justify-between items-center">
<span className="" style={{ color: "var(--color-admin-on-surface-variant)" }}>Active Now</span>
<span className="" style={{ color: "#4ade80" }}>2,109</span>
</div>
<div className="w-full h-1.5 rounded-full" style={{ backgroundColor: "var(--color-admin-surface-container-low)" }}>
<div className="h-full rounded-full" style={{ backgroundColor: "#4ade80" }} style={{ width: '65%' }}></div>
</div>
</div>
</div>
</div>
</div>
</main>
</body></html>
