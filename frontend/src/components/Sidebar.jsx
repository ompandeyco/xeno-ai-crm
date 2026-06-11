import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, Wand2, BarChart3 } from 'lucide-react';

const Sidebar = () => {
  return (
    <div className="w-64 bg-white border-r border-gray-200 h-screen flex flex-col">
      <div className="h-16 flex items-center px-6 border-b border-gray-200">
        <h1 className="text-xl font-bold text-indigo-600 tracking-tight flex items-center gap-2">
          <Wand2 className="w-6 h-6" />
          Xeno AI Copilot
        </h1>
      </div>
      
      <nav className="flex-1 p-4 space-y-1">
        <NavItem to="/" icon={<LayoutDashboard />} label="Dashboard" />
        <NavItem to="/ai-studio" icon={<Wand2 />} label="AI Studio" />
        <NavItem to="/customers" icon={<Users />} label="Customers" />
        <NavItem to="/analytics" icon={<BarChart3 />} label="Analytics" />
      </nav>
      
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-medium">
            OM
          </div>
          <div className="text-sm">
            <p className="font-medium text-gray-900">Om Pandey</p>
            <p className="text-gray-500 text-xs">Marketer</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const NavItem = ({ to, icon, label }) => {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
          isActive
            ? 'bg-indigo-50 text-indigo-700'
            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
        }`
      }
    >
      {React.cloneElement(icon, { className: 'w-5 h-5' })}
      {label}
    </NavLink>
  );
};

export default Sidebar;
