import { NavLink, Outlet } from "react-router-dom";

export default function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <NavLink to="/" className="font-extrabold tracking-tight text-forest">B.F.T</NavLink>
          <nav className="flex gap-5 text-sm text-muted">
            <NavLink to="/register" className="hover:text-ink">Register</NavLink>
            <NavLink to="/captain" className="hover:text-ink">Captain</NavLink>
            <NavLink to="/admin" className="hover:text-ink">Admin</NavLink>
          </nav>
        </div>
      </header>
      <main className="flex-1"><Outlet /></main>
    </div>
  );
}
