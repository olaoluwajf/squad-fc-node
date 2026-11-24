import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Register from "./pages/Register";
import CaptainLogin from "./pages/CaptainLogin";
import CaptainDashboard from "./pages/CaptainDashboard";
import Admin from "./pages/Admin";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="register" element={<Register />} />
        <Route path="captain" element={<CaptainLogin />} />
        <Route path="captain/dashboard" element={<CaptainDashboard />} />
        <Route path="admin" element={<Admin />} />
      </Route>
    </Routes>
  );
}
