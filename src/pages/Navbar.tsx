import React from 'react';

export type AppView =
  | 'dashboard'
  | 'inventory'
  | 'cashbox'
  | 'reports'
  | 'users'
  | 'settings';

export type UserRole = 'administrador' | 'vendedor' | 'contabilidad' | 'técnico';

interface NavbarProps {
  currentView: AppView;
  userRole: UserRole;
  onNavigate: (view: AppView) => void;
  onNewEntry?: () => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  userRole,
  onNavigate,
  onNewEntry,
  onLogout,
}) => {
  const canSeeAdminButtons = userRole === 'administrador';
  const canSeeReports =
    userRole === 'administrador' || userRole === 'contabilidad';

  return (
    <header className="w-full bg-white border-b border-slate-200 px-6 py-4 mb-6 rounded-xl shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            {currentView === 'cashbox'
              ? 'Módulo de Caja y Ventas'
              : 'Módulo de Compras, Inventario y Taller'}
          </h1>
          <p className="text-xs text-slate-500">
            {currentView === 'cashbox'
              ? 'Cobros en Bs., control de sesión y emisión de notas'
              : 'Compras al contado o a crédito, control de stock y repotenciación'}
          </p>
        </div>

        <nav className="flex flex-wrap items-center gap-2">
          {onNewEntry && (
            <button
              type="button"
              onClick={onNewEntry}
              className="px-3.5 py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition cursor-pointer"
            >
              + Nota de Ingreso
            </button>
          )}

          <button
            type="button"
            onClick={() => onNavigate('dashboard')}
            className={`px-3.5 py-2 rounded-lg text-sm font-medium transition cursor-pointer ${
              currentView === 'dashboard'
                ? 'bg-slate-800 text-white'
                : 'bg-slate-600 text-white hover:bg-slate-700'
            }`}
          >
            Inicio
          </button>

          <button
            type="button"
            onClick={() => onNavigate('inventory')}
            className={`px-3.5 py-2 rounded-lg text-sm font-medium transition cursor-pointer ${
              currentView === 'inventory'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Inventario y Taller
          </button>

          <button
            type="button"
            onClick={() => onNavigate('cashbox')}
            className={`px-3.5 py-2 rounded-lg text-sm font-medium transition cursor-pointer ${
              currentView === 'cashbox'
                ? 'bg-purple-700 text-white'
                : 'bg-emerald-600 text-white hover:bg-emerald-700'
            }`}
          >
            Ir a Caja
          </button>

          {canSeeReports && (
            <button
              type="button"
              onClick={() => onNavigate('reports')}
              className={`px-3.5 py-2 rounded-lg text-sm font-medium transition cursor-pointer ${
                currentView === 'reports'
                  ? 'bg-blue-700 text-white'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              Reportes
            </button>
          )}

          {canSeeAdminButtons && (
            <>
              <button
                type="button"
                onClick={() => onNavigate('users')}
                className={`px-3.5 py-2 rounded-lg text-sm font-medium transition cursor-pointer ${
                  currentView === 'users'
                    ? 'bg-indigo-700 text-white'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                Usuarios
              </button>

              <button
                type="button"
                onClick={() => onNavigate('settings')}
                className={`px-3.5 py-2 rounded-lg text-sm font-medium transition cursor-pointer ${
                  currentView === 'settings'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-800 text-white hover:bg-slate-900'
                }`}
              >
                Configuración
              </button>
            </>
          )}

          <button
            type="button"
            onClick={onLogout}
            className="px-3.5 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition cursor-pointer"
          >
            Cerrar Sesión
          </button>
        </nav>
      </div>
    </header>
  );
};
