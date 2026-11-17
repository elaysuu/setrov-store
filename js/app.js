(function () {
  const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const store = window.STORE || { products: [], wallet_configured: false };

  function b58encode(bytes) {
    let n = 0n;
    for (const b of bytes) n = (n << 8n) + BigInt(b);
    let out = "";
    while (n > 0n) {
      const r = n % 58n;
      n = n / 58n;
      out = B58[Number(r)] + out;
    }
    let pad = 0;
    for (const b of bytes) {
      if (b === 0) pad += 1;
      else break;
    }
    return "1".repeat(pad) + (out || "");
  }

  function randomReference() {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return b58encode(bytes);
  }

  function encodeQuery(params) {
    return Object.keys(params)
      .map((k) => encodeURIComponent(k) + "=" + encodeURIComponent(params[k]))
      .join("&");
  }

  function payUrl(product, email, reference) {
    const memo = "SR:" + product.sku + ":" + email.trim();
    if (memo.length > 87) throw new Error("Email is too long for the payment memo. Use a shorter address.");
    if (!email.includes("@") || email.includes(" ") || email.includes(":")) {
      throw new Error("Use a normal email (no spaces or colons).");
    }
    const params = {
      amount: String(product.price_usdc),
      "spl-token": store.usdc_mint,
      reference: reference,
      label: store.merchant_name || "Setrov Studio",
      message: product.title,
      memo: memo,
    };
    return { url: "solana:" + store.solana_address + "?" + encodeQuery(params), memo: memo, reference: reference };
  }

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      Object.entries(attrs).forEach(([k, v]) => {
        if (k === "class") node.className = v;
        else if (k === "text") node.textContent = v;
        else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
        else if (v !== null && v !== undefined) node.setAttribute(k, v);
      });
    }
    (children || []).forEach((c) => node.appendChild(c));
    return node;
  }

  function money(n) {
    if (!n) return "Free";
    const s = Number(n).toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
    return s + " USDC";
  }

  function renderSection(id, title, items) {
    const host = document.getElementById(id);
    if (!host) return;
    host.innerHTML = "";
    if (!items.length) return;
    host.appendChild(el("h2", { text: title }));
    const grid = el("div", { class: "grid" });
    items.forEach((p) => grid.appendChild(card(p)));
    host.appendChild(grid);
  }

  function card(p) {
    const isFree = !p.price_usdc;
    const action = isFree
      ? el("a", { class: "btn", href: p.free_copy, download: "", text: "Download" })
      : el("button", {
          text: store.wallet_configured ? "Buy" : "Coming soon",
          disabled: store.wallet_configured ? null : "disabled",
          onclick: function () { openCheckout(p); },
        });
    return el("article", { class: "card" }, [
      el("img", { src: p.cover, alt: p.title }),
      el("div", { class: "body" }, [
        el("h3", { text: p.title }),
        el("p", { text: p.short }),
        el("div", { class: "row" }, [el("span", { class: "price", text: money(p.price_usdc) }), action]),
      ]),
    ]);
  }

  const dialog = document.getElementById("checkout");
  const ticketWrap = document.getElementById("ticket-wrap");
  let current = null;

  function openCheckout(p) {
    if (!store.wallet_configured) return;
    current = p;
    document.getElementById("co-title").textContent = p.title;
    document.getElementById("co-short").textContent = money(p.price_usdc) + " · exact USDC amount, plus network fee";
    document.getElementById("email").value = "";
    ticketWrap.hidden = true;
    document.getElementById("ticket").textContent = "";
    if (typeof dialog.showModal === "function") dialog.showModal();
  }

  document.getElementById("co-close").addEventListener("click", () => dialog.close());
  document.querySelector("#checkout form").addEventListener("submit", (ev) => {
    ev.preventDefault();
    if (!current) return;
    const email = document.getElementById("email").value.trim();
    try {
      const ticket = payUrl(current, email, randomReference());
      const text = [
        current.title,
        "Amount: " + current.price_usdc + " USDC",
        "To: " + store.solana_address,
        "Memo: " + ticket.memo,
        "Reference: " + ticket.reference,
        "Payment link:",
        ticket.url,
        "",
        "Send the exact amount. Keep this ticket until the download email arrives.",
      ].join("\n");
      document.getElementById("ticket").textContent = text;
      document.getElementById("co-open").href = ticket.url;
      ticketWrap.hidden = false;
      document.getElementById("co-copy").onclick = async function () {
        try {
          await navigator.clipboard.writeText(ticket.url);
          this.textContent = "Copied";
        } catch (e) {
          this.textContent = "Copy failed — select the link";
        }
      };
    } catch (err) {
      alert(err.message || String(err));
    }
  });

  const products = store.products || [];
  renderSection("featured", "Bundle", products.filter((p) => p.category === "bundle"));
  renderSection("audio", "Audio packs", products.filter((p) => p.category === "audio"));
  renderSection("pixel", "Pixel assets", products.filter((p) => p.category === "pixel"));
  renderSection("free", "Free", products.filter((p) => p.category === "free"));

  const warn = document.getElementById("wallet-warn");
  if (!store.wallet_configured) warn.hidden = false;
  const support = document.getElementById("support-line");
  if (store.support_email) support.textContent = "Support: " + store.support_email;
})();
