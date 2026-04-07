import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  Cigarette,
  Heart,
  Baby,
  GitBranch,
  Zap,
  TreeDeciduous,
  Calendar,
  ScanLine,
  Menu,
  X,
  Clock,
  Images,
} from 'lucide-react';

const navItems = [
  { section: 'メイン', items: [
    { to: '/', icon: LayoutDashboard, label: 'ダッシュボード' },
  ]},
  { section: 'データ管理', items: [
    { to: '/stallions', icon: Cigarette, label: '種牡馬' },
    { to: '/mares', icon: Heart, label: '繁殖牝馬' },
    { to: '/foals', icon: Baby, label: '幼駒' },
    { to: '/lineages', icon: GitBranch, label: '系統' },
  ]},
  { section: '進行中・メモ', items: [
    { to: '/calendar', icon: Clock, label: '進行カレンダー' },
    { to: '/gallery', icon: Images, label: '牧場史・ギャラリー' },
  ]},
  { section: '配合シミュレーター', items: [
    { to: '/breeding/simulator', icon: Zap, label: '爆発力計算' },
    { to: '/breeding/pedigree', icon: TreeDeciduous, label: '血統表入力' },
    { to: '/breeding/plans', icon: Calendar, label: '配合計画' },
  ]},
  { section: 'OCR 自動入力', items: [
    { to: '/ocr', icon: ScanLine, label: 'スクショ → 自動入力' },
  ]},
];

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="flex h-screen w-full bg-slate-50 text-slate-900 overflow-hidden">
      {/* 
        ========================================
        MOBILE HEADER
        ========================================
      */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 flex items-center h-16 bg-white border-b border-slate-200 px-4 shadow-sm">
        <button
          className="p-2 -ml-2 mr-2 rounded-md text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-primary"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label={sidebarOpen ? 'メニューを閉じる' : 'メニューを開く'}
        >
          {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
        <div className="flex items-center gap-2 font-bold text-lg text-slate-900">
          <span className="text-xl">🐎</span>
          <span>WinPost</span>
        </div>
      </header>

      {/* 
        ========================================
        SIDEBAR OVERLAY
        ========================================
      */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden" 
          onClick={closeSidebar} 
        />
      )}

      {/* 
        ========================================
        SIDEBAR
        ========================================
      */}
      <aside 
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-72 bg-white border-r border-slate-200 shadow-xl lg:shadow-none
          transform transition-transform duration-300 ease-in-out flex flex-col
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="flex items-center h-16 px-6 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3 font-bold text-xl text-slate-900">
            <div className="text-2xl bg-slate-100 p-2 rounded-xl">🐎</div>
            <span>WinPost</span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-8 scrollbar-thin scrollbar-thumb-slate-200">
          {navItems.map((section) => (
            <div key={section.section} className="space-y-2">
              <h3 className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                {section.section}
              </h3>
              <div className="space-y-1">
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) => `
                      flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 font-medium text-sm
                      ${isActive 
                        ? 'bg-primary text-primary-foreground shadow-sm' 
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }
                    `}
                    onClick={closeSidebar}
                  >
                    <item.icon className="w-5 h-5 flex-shrink-0 opacity-80" />
                    <span className="truncate">{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* 
        ========================================
        MAIN CONTENT
        ========================================
      */}
      <main className="flex-1 overflow-y-auto lg:overflow-hidden pt-16 lg:pt-0 bg-slate-50 relative flex flex-col">
        {/* Optional decorative background glow */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-blue-100 blur-3xl opacity-50 pointer-events-none" />
        
        <div className="flex-1 p-4 lg:p-8 overflow-y-auto relative z-10 w-full max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
