(function () {
  "use strict";

  // ---------- Theme (immer im Normalmodus starten, Umschalter pro Sitzung) ----------
  document.body.classList.remove("dark");
  document.documentElement.classList.remove("dark");
  var themeToggleBtn = document.getElementById("theme-toggle");
  var MOON_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  var SUN_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
  function updateThemeToggleIcon() {
    var isDark = document.body.classList.contains("dark");
    themeToggleBtn.innerHTML = isDark ? SUN_SVG : MOON_SVG;
    themeToggleBtn.setAttribute("aria-label", isDark ? "Normalmodus umschalten" : "Dunkelmodus umschalten");
  }
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener("click", function () {
      document.body.classList.toggle("dark");
      document.documentElement.classList.toggle("dark");
      updateThemeToggleIcon();
    });
    updateThemeToggleIcon();
  }

  var APPS_KEY = "verteiler-apps";
  var HISTORY_KEY = "verteiler-history";
  var DOT_COLORS = [
    "var(--violet)", "var(--coral)", "var(--teal)",
    "var(--amber)", "var(--pink)", "#3B82F6", "#22C55E", "#A855F7"
  ];
  var CONFIRM_TIMEOUT = 3500;

  // ---------- Storage-Helfer ----------
  function loadApps() {
    try {
      var raw = localStorage.getItem(APPS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }
  function saveApps(apps) {
    localStorage.setItem(APPS_KEY, JSON.stringify(apps));
  }
  function loadHistory() {
    try {
      var raw = localStorage.getItem(HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }
  function saveHistory(history) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  // ---------- Toast ----------
  var toastEl = document.getElementById("toast");
  var toastTimer = null;
  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.classList.remove("show");
    }, 2600);
  }

  // ---------- Zwei-Klick-Löschbestätigung ----------
  // Erster Klick verwandelt den Button kurz in "Sicher?"; erst der zweite
  // Klick innerhalb weniger Sekunden löst wirklich die Aktion aus.
  function handleConfirmClick(btn, onConfirm) {
    if (btn.dataset.confirm === "1") {
      clearTimeout(btn._confirmTimer);
      onConfirm();
      return;
    }
    btn.dataset.confirm = "1";
    btn.dataset.label = btn.textContent;
    btn.textContent = "Sicher?";
    btn.classList.add("confirm-danger");
    btn._confirmTimer = setTimeout(function () {
      btn.textContent = btn.dataset.label;
      btn.classList.remove("confirm-danger");
      delete btn.dataset.confirm;
    }, CONFIRM_TIMEOUT);
  }

  function dotSpan(colorIndex) {
    var color = DOT_COLORS[colorIndex % DOT_COLORS.length];
    return '<span class="app-dot" style="background:' + color + '"></span>';
  }

  // ---------- Rendering: Checkliste (Schritt 1) ----------
  var checklistEl = document.getElementById("app-checklist");
  var noAppsHint = document.getElementById("no-apps-hint");

  function renderChecklist(preserveChecked) {
    var previouslyChecked = preserveChecked
      ? Array.prototype.slice
          .call(checklistEl.querySelectorAll('input[type="checkbox"]:checked'))
          .map(function (cb) { return cb.value; })
      : [];
    var apps = loadApps();
    checklistEl.innerHTML = "";
    if (apps.length === 0) {
      noAppsHint.hidden = false;
      return;
    }
    noAppsHint.hidden = true;
    apps.forEach(function (app) {
      var row = document.createElement("label");
      row.className = "app-check-row";
      var checked = previouslyChecked.indexOf(app.id) !== -1 ? " checked" : "";
      row.innerHTML =
        '<input type="checkbox" value="' + app.id + '"' + checked + '>' +
        dotSpan(app.color || 0) +
        '<span class="app-info">' +
          '<span class="app-name">' + escapeHtml(app.name) + '</span>' +
          (app.note ? '<span class="app-note">' + escapeHtml(app.note) + '</span>' : '') +
        '</span>';
      checklistEl.appendChild(row);
    });
  }

  // ---------- Rendering: App-Verwaltung (Schritt 2) ----------
  var manageListEl = document.getElementById("app-manage-list");
  var editingAppId = null;

  var nameInput = document.getElementById("new-app-name");
  var urlInput = document.getElementById("new-app-url");
  var noteInput = document.getElementById("new-app-note");
  var addAppBtn = document.getElementById("add-app-btn");
  var cancelEditBtn = document.getElementById("cancel-edit-btn");

  function renderManageList() {
    var apps = loadApps();
    manageListEl.innerHTML = "";
    apps.forEach(function (app, index) {
      var row = document.createElement("div");
      row.className = "app-manage-row";
      row.innerHTML =
        dotSpan(app.color || 0) +
        '<span class="app-info">' +
          '<span class="app-name">' + escapeHtml(app.name) + '</span>' +
          '<span class="app-url">' + escapeHtml(app.url) + '</span>' +
        '</span>' +
        '<span class="row-actions">' +
          '<button class="icon-btn move" data-move-up="' + app.id + '" ' + (index === 0 ? "disabled" : "") + ' title="Nach oben">↑</button>' +
          '<button class="icon-btn move" data-move-down="' + app.id + '" ' + (index === apps.length - 1 ? "disabled" : "") + ' title="Nach unten">↓</button>' +
          '<button class="icon-btn edit" data-edit="' + app.id + '">Bearbeiten</button>' +
          '<button class="icon-btn" data-remove="' + app.id + '">Entfernen</button>' +
        '</span>';
      manageListEl.appendChild(row);
    });
  }

  function startEdit(app) {
    editingAppId = app.id;
    nameInput.value = app.name;
    urlInput.value = app.url;
    noteInput.value = app.note || "";
    addAppBtn.textContent = "Änderungen speichern";
    cancelEditBtn.hidden = false;
    nameInput.focus();
  }

  function stopEdit() {
    editingAppId = null;
    nameInput.value = "";
    urlInput.value = "";
    noteInput.value = "";
    addAppBtn.textContent = "App hinzufügen";
    cancelEditBtn.hidden = true;
  }

  cancelEditBtn.addEventListener("click", function () {
    stopEdit();
  });

  manageListEl.addEventListener("click", function (e) {
    var removeBtn = e.target.closest("[data-remove]");
    if (removeBtn) {
      handleConfirmClick(removeBtn, function () {
        var id = removeBtn.getAttribute("data-remove");
        var apps = loadApps().filter(function (a) { return a.id !== id; });
        saveApps(apps);
        if (editingAppId === id) stopEdit();
        renderManageList();
        renderChecklist(true);
        showToast("App entfernt");
      });
      return;
    }

    var editBtn = e.target.closest("[data-edit]");
    if (editBtn) {
      var id2 = editBtn.getAttribute("data-edit");
      var app = loadApps().filter(function (a) { return a.id === id2; })[0];
      if (app) startEdit(app);
      return;
    }

    var upBtn = e.target.closest("[data-move-up]");
    if (upBtn) {
      moveApp(upBtn.getAttribute("data-move-up"), -1);
      return;
    }
    var downBtn = e.target.closest("[data-move-down]");
    if (downBtn) {
      moveApp(downBtn.getAttribute("data-move-down"), 1);
      return;
    }
  });

  function moveApp(id, direction) {
    var apps = loadApps();
    var index = apps.findIndex(function (a) { return a.id === id; });
    var target = index + direction;
    if (index === -1 || target < 0 || target >= apps.length) return;
    var tmp = apps[index];
    apps[index] = apps[target];
    apps[target] = tmp;
    saveApps(apps);
    renderManageList();
    renderChecklist(true);
  }

  addAppBtn.addEventListener("click", function () {
    var name = nameInput.value.trim();
    var url = urlInput.value.trim();
    var note = noteInput.value.trim();

    if (!name || !url) {
      showToast("Bitte Name und Link angeben");
      return;
    }
    if (!/^https?:\/\//i.test(url)) {
      url = "https://" + url;
    }

    var apps = loadApps();

    if (editingAppId) {
      apps = apps.map(function (a) {
        if (a.id !== editingAppId) return a;
        return { id: a.id, name: name, url: url, note: note, color: a.color || 0 };
      });
      saveApps(apps);
      stopEdit();
      renderManageList();
      renderChecklist(true);
      showToast("App aktualisiert");
      return;
    }

    apps.push({ id: uid(), name: name, url: url, note: note, color: apps.length % DOT_COLORS.length });
    saveApps(apps);

    nameInput.value = "";
    urlInput.value = "";
    noteInput.value = "";

    renderManageList();
    renderChecklist(true);
    showToast("App hinzugefügt");
  });

  // ---------- Sichern / Wiederherstellen ----------
  document.getElementById("export-btn").addEventListener("click", function () {
    var data = { apps: loadApps(), history: loadHistory(), exportedAt: new Date().toISOString() };
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    var stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = "verteiler-sicherung-" + stamp + ".json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast("Sicherung heruntergeladen");
  });

  var importFileInput = document.getElementById("import-file");
  document.getElementById("import-btn").addEventListener("click", function () {
    importFileInput.click();
  });
  importFileInput.addEventListener("change", function () {
    var file = importFileInput.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var data;
      try {
        data = JSON.parse(reader.result);
      } catch (e) {
        showToast("Ungültige Sicherungsdatei");
        importFileInput.value = "";
        return;
      }
      if (!data || !Array.isArray(data.apps)) {
        showToast("Ungültige Sicherungsdatei");
        importFileInput.value = "";
        return;
      }
      var ok = window.confirm("Vorhandene Apps und Verlauf durch die Sicherung ersetzen?");
      if (!ok) {
        importFileInput.value = "";
        return;
      }
      saveApps(data.apps || []);
      saveHistory(Array.isArray(data.history) ? data.history : []);
      stopEdit();
      renderManageList();
      renderChecklist();
      renderHistory();
      importFileInput.value = "";
      showToast("Daten wiederhergestellt");
    };
    reader.readAsText(file);
  });

  // ---------- Nachricht zusammenbauen ----------
  function buildMessage(selectedApps, recipientName) {
    var NL = "\r\n";
    var greeting = recipientName ? "Hallo " + recipientName + "," : "Hallo,";

    var appLines = selectedApps
      .map(function (a) { return "- " + a.name + ":" + NL + "" + NL + a.url; })
      .join(NL + NL);

    var body = [
      greeting,
      "",
      "ich habe dir folgende App(s) zum Ausprobieren freigegeben:",
      "",
      appLines,
      "",
      "So installierst du sie auf deinem Handy:",
      "",
      "iPhone (Safari):",
      "",
      "1. Link öffnen",
      "",
      "2. Unten auf das Teilen-Symbol tippen",
      "",
      "3. \"Zum Home-Bildschirm\" auswählen",
      "",
      "",
      "Android (Chrome):",
      "",
      "1. Link öffnen",
      "",
      "2. Oben rechts auf die drei Punkte tippen",
      "",
      "3. \"App installieren\" bzw. \"Zum Startbildschirm hinzufügen\" wählen",
      "",
      "Danach erscheint ein eigenes App-Symbol auf dem Homescreen.",
      "Du kannst den Link natürlich auch im Browser öffnen, ganz ohne Installation.",
      "",
      "Viel Spaß.",
      "",
      "Liebe Grüße,",
      "Jan"
    ].join(NL);

    var subject = "App(s) von Jan Dierlich";

    return { subject: subject, body: body };
  }

  function getSelectedApps() {
    var apps = loadApps();
    var checked = Array.prototype.slice
      .call(checklistEl.querySelectorAll('input[type="checkbox"]:checked'))
      .map(function (cb) { return cb.value; });
    return apps.filter(function (a) { return checked.indexOf(a.id) !== -1; });
  }

  function logHistory(selectedApps, email, recipientName) {
    var history = loadHistory();
    history.unshift({
      id: uid(),
      date: new Date().toISOString(),
      email: email,
      recipientName: recipientName,
      apps: selectedApps.map(function (a) { return a.name; }),
      appIds: selectedApps.map(function (a) { return a.id; })
    });
    saveHistory(history);
    renderHistory();
  }

  // ---------- Mail vorbereiten (Schritt 1) ----------
  var prepareMailBtn = document.getElementById("prepare-mail-btn");
  prepareMailBtn.addEventListener("click", function () {
    var selectedApps = getSelectedApps();
    var emailInput = document.getElementById("recipient-email");
    var nameFieldInput = document.getElementById("recipient-name");
    var email = emailInput.value.trim();
    var recipientName = nameFieldInput.value.trim();

    if (selectedApps.length === 0) {
      showToast("Bitte mindestens eine App auswählen");
      return;
    }
    if (!email) {
      showToast("Bitte eine E-Mail-Adresse eingeben");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showToast("E-Mail-Adresse sieht nicht gültig aus");
      return;
    }

    var msg = buildMessage(selectedApps, recipientName);
    var mailtoUrl =
      "mailto:" + encodeURIComponent(email) +
      "?subject=" + encodeURIComponent(msg.subject) +
      "&body=" + encodeURIComponent(msg.body);

    logHistory(selectedApps, email, recipientName);

    prepareMailBtn.classList.add("success");
    prepareMailBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Vorbereitet';
    setTimeout(function () {
      prepareMailBtn.classList.remove("success");
      prepareMailBtn.textContent = "Mail vorbereiten";
    }, 1800);

    window.location.href = mailtoUrl;
  });

  // ---------- Anders teilen (Web Share API) ----------
  var shareBtn = document.getElementById("share-btn");
  if (navigator.share) {
    shareBtn.hidden = false;
  }
  shareBtn.addEventListener("click", function () {
    var selectedApps = getSelectedApps();
    if (selectedApps.length === 0) {
      showToast("Bitte mindestens eine App auswählen");
      return;
    }
    var nameFieldInput = document.getElementById("recipient-name");
    var emailInput = document.getElementById("recipient-email");
    var recipientName = nameFieldInput.value.trim();
    var msg = buildMessage(selectedApps, recipientName);

    navigator.share({ title: msg.subject, text: msg.body })
      .then(function () {
        logHistory(selectedApps, emailInput.value.trim(), recipientName);
        showToast("Geteilt");
      })
      .catch(function () { /* Nutzer hat abgebrochen — kein Fehler */ });
  });

  // ---------- Verlauf (Schritt 3) ----------
  var historyListEl = document.getElementById("history-list");
  var noHistoryHint = document.getElementById("no-history-hint");

  function formatDate(iso) {
    var d = new Date(iso);
    return d.toLocaleDateString("de-DE") + " · " + d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  }

  function renderHistory() {
    var history = loadHistory();
    historyListEl.innerHTML = "";
    if (history.length === 0) {
      noHistoryHint.hidden = false;
      return;
    }
    noHistoryHint.hidden = true;
    history.forEach(function (entry) {
      var row = document.createElement("div");
      row.className = "history-row";
      var recipientLabel = entry.recipientName
        ? entry.recipientName + (entry.email ? " (" + entry.email + ")" : "")
        : (entry.email || "—");
      row.innerHTML =
        '<div class="history-top">' +
          '<span class="history-recipient">' + escapeHtml(recipientLabel) + '</span>' +
          '<span class="history-date">' + formatDate(entry.date) + '</span>' +
        '</div>' +
        '<div class="history-apps">' + escapeHtml(entry.apps.join(", ")) + '</div>' +
        '<span class="row-actions">' +
          '<button class="icon-btn resend" data-resend="' + entry.id + '">Erneut senden</button>' +
          '<button class="icon-btn" data-remove-history="' + entry.id + '">Eintrag löschen</button>' +
        '</span>';
      historyListEl.appendChild(row);
    });
  }

  historyListEl.addEventListener("click", function (e) {
    var removeBtn = e.target.closest("[data-remove-history]");
    if (removeBtn) {
      handleConfirmClick(removeBtn, function () {
        var id = removeBtn.getAttribute("data-remove-history");
        var history = loadHistory().filter(function (h) { return h.id !== id; });
        saveHistory(history);
        renderHistory();
      });
      return;
    }

    var resendBtn = e.target.closest("[data-resend]");
    if (resendBtn) {
      var id2 = resendBtn.getAttribute("data-resend");
      var entry = loadHistory().filter(function (h) { return h.id === id2; })[0];
      if (!entry) return;

      var apps = loadApps();
      var matched = [];
      if (entry.appIds && entry.appIds.length) {
        matched = apps.filter(function (a) { return entry.appIds.indexOf(a.id) !== -1; });
      } else {
        matched = apps.filter(function (a) { return entry.apps.indexOf(a.name) !== -1; });
      }

      document.getElementById("recipient-name").value = entry.recipientName || "";
      document.getElementById("recipient-email").value = entry.email || "";

      renderChecklist();
      matched.forEach(function (a) {
        var cb = checklistEl.querySelector('input[value="' + a.id + '"]');
        if (cb) cb.checked = true;
      });

      document.getElementById("send-card").scrollIntoView({ behavior: "smooth", block: "start" });
      if (matched.length < (entry.apps ? entry.apps.length : 0)) {
        showToast("Empfänger übernommen — einige Apps wurden inzwischen entfernt");
      } else {
        showToast("Empfänger & Apps übernommen");
      }
      return;
    }
  });

  // ---------- Utils ----------
  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // ---------- Service Worker ----------
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    });
  }

  // ---------- Init ----------
  renderChecklist();
  renderManageList();
  renderHistory();
})();
