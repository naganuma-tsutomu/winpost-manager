import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  Cigarette,
  Heart,
  Baby,
  GitBranch,
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
];

export function Layout() {
  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <div className="sidebar-logo-icon">🐎</div>
            <span className="sidebar-logo-text">WinPost</span>
          </div>
        </div>
        <nav className="sidebar-nav">
          {navItems.map((section) => (
            <div key={section.section}>
              <div className="nav-section-title">{section.section}</div>
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                >
                  <item.icon />
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
