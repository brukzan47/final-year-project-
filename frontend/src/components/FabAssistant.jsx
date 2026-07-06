import React, { useEffect, useMemo, useRef, useState } from "react";
import { Bot, ChevronDown, MessageCircle, Send, Sparkles, X } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";

const STORAGE_KEY = "global.assistant.chat";

const QUICK_PROMPTS = [
  "Where do I record payments?",
  "How do I submit a declaration?",
  "What documents are required?",
  "How do I track a shipment?",
];

function localReply(message, role, pathname) {
  const low = String(message || "").toLowerCase();
  if (/payment|receipt|pay|gateway/.test(low)) {
    return {
      text: "Open Payments to initiate CBE, Telebirr, or Chapa payment, use the local fallback checkout when a live provider is not configured, then wait for Finance approval before receipt download.",
      to: "/payments",
      label: "Open Payments",
    };
  }
  if (/declaration|declare|form|submit/.test(low)) {
    return {
      text: "Create or review declarations from the Declarations area. Importers and officers enter shipment, tariff, value, duty, and supporting document details before moving to payment.",
      to: role === "Customs Officer" || role === "Admin" || role === "Super Admin" ? "/declarations-admin" : "/declarations",
      label: "Open Declarations",
    };
  }
  if (/document|invoice|packing|origin|license/.test(low)) {
    return {
      text: "Typical customs documents include commercial invoice, packing list, bill of lading or airway bill, certificate of origin, import license when required, and permits for restricted goods.",
      to: "/file-upload",
      label: "Open Documents",
    };
  }
  if (/track|shipment|where|location/.test(low)) {
    return {
      text: "Use My Tracking as an importer, or the tracking-related shipment pages for officer workflows. Search by shipment or declaration reference where available.",
      to: role === "Importer" ? "/my-tracking" : "/shipments",
      label: role === "Importer" ? "Open Tracking" : "Open Shipments",
    };
  }
  if (/report|finance|revenue|analytics/.test(low)) {
    return {
      text: "Reports and finance dashboards show payment status, revenue, reconciliation, refunds, and operational analytics according to your role permissions.",
      to: role === "Finance Officer" ? "/finance" : "/reports",
      label: role === "Finance Officer" ? "Open Finance" : "Open Reports",
    };
  }
  if (/where am i|this page|current page/.test(low)) {
    return {
      text: `You are on ${pathname || "the current page"}. Ask for a workflow, required document, next step, or a module name and I can guide you.`,
    };
  }
  return {
    text: "I can help with declarations, payments, documents, shipment tracking, clearance, reports, and navigation. Ask a question or use one of the quick prompts.",
  };
}

export default function FabAssistant() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { token, role } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([
    { from: "assistant", text: "Hi. I can help you move through declarations, payments, documents, tracking, and reports." },
  ]);
  const boxRef = useRef(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed) && parsed.length) setMessages(parsed);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-20)));
    } catch {}
  }, [messages]);

  useEffect(() => {
    try {
      boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight, behavior: "smooth" });
    } catch {}
  }, [messages, open]);

  const contextLine = useMemo(() => {
    const page = location.pathname === "/" ? "/home" : location.pathname;
    return `${role || "User"} | ${page}`;
  }, [location.pathname, role]);

  if (!token) return null;

  const ask = async (value) => {
    const question = String(value ?? input).trim();
    if (!question || busy) return;
    setInput("");
    setOpen(true);
    setMessages((prev) => [...prev, { from: "user", text: question }]);

    setBusy(true);
    try {
      const history = messages
        .filter((message) => message.text)
        .slice(-6)
        .map((message) => ({ role: message.from === "assistant" ? "assistant" : "user", content: message.text }));
      const response = await api.post("/assistant/chat", {
        message: `${question}\n\nCurrent role: ${role || "Unknown"}\nCurrent page: ${location.pathname}`,
        history,
      });
      const text = String(response?.answer || "").trim();
      if (!text) throw new Error("Assistant returned an empty answer");
      setMessages((prev) => [...prev, { from: "assistant", text }]);
    } catch {
      const fallback = localReply(question, role, location.pathname);
      setMessages((prev) => [...prev, { from: "assistant", text: fallback.text, to: fallback.to, label: fallback.label }]);
    } finally {
      setBusy(false);
    }
  };

  const clear = () => {
    const fresh = { from: "assistant", text: "History cleared. What do you need help with?" };
    setMessages([fresh]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    toast?.info?.("Assistant history cleared");
  };

  return (
    <div className={`global-ai-assistant ${open ? "open" : ""}`}>
      {open && (
        <section className="global-ai-panel" aria-label="AI assistance">
          <div className="global-ai-panel-head">
            <span className="global-ai-mark"><Bot size={18} /></span>
            <div>
              <div className="global-ai-title">AI Assistance</div>
              <div className="global-ai-context">{contextLine}</div>
            </div>
            <button type="button" className="global-ai-icon-btn" onClick={() => setOpen(false)} aria-label="Minimize assistant">
              <ChevronDown size={18} />
            </button>
            <button type="button" className="global-ai-icon-btn" onClick={() => setOpen(false)} aria-label="Close assistant">
              <X size={18} />
            </button>
          </div>

          <div className="global-ai-quick">
            {QUICK_PROMPTS.map((prompt) => (
              <button key={prompt} type="button" onClick={() => ask(prompt)} disabled={busy}>
                {prompt}
              </button>
            ))}
          </div>

          <div ref={boxRef} className="global-ai-messages">
            {messages.map((message, index) => (
              <div key={`${message.from}-${index}`} className={`global-ai-message ${message.from}`}>
                <div>{message.text}</div>
                {message.to && (
                  <button type="button" onClick={() => navigate(message.to)}>
                    {message.label || "Open"}
                  </button>
                )}
              </div>
            ))}
            {busy && <div className="global-ai-message assistant">Thinking...</div>}
          </div>

          <form className="global-ai-form" onSubmit={(event) => { event.preventDefault(); ask(); }}>
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask for help anywhere..."
            />
            <button type="submit" disabled={busy || !input.trim()} aria-label="Send assistant message">
              <Send size={16} />
            </button>
          </form>
          <button type="button" className="global-ai-clear" onClick={clear}>
            Clear chat
          </button>
        </section>
      )}

      <button type="button" className="global-ai-fab" onClick={() => setOpen((value) => !value)} aria-label="Open AI assistance">
        {open ? <ChevronDown size={22} /> : <MessageCircle size={22} />}
        <span><Sparkles size={14} /> AI Help</span>
      </button>
    </div>
  );
}
