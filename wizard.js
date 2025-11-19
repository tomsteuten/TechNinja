(function () {
  var machines = [];
  var currentMachine = null;
  var currentSymptom = null;
  var stepHistory = [];
  var currentStepId = null;

  function $(id) { return document.getElementById(id); }

  function loadMachines() {
    machines = [
      {
        id: "mastrena2",
        name: "Mastrena II",
        subtitle: "Superauto espresso",
        tag: "Coffee",
        config: "machines/mastrena2.json"
      }
    ];
    renderMachines();
    if (machines.length === 1) {
      selectMachine(machines[0].id);
    }
  }

  function renderMachines() {
    var list = $("machineList");
    list.innerHTML = "";
    machines.forEach(function (m) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "machine-btn";
      btn.setAttribute("data-id", m.id);

      var leftWrap = document.createElement("div");
      leftWrap.style.display = "flex";
      leftWrap.style.flexDirection = "column";

      var mainSpan = document.createElement("span");
      mainSpan.className = "main";
      mainSpan.textContent = m.name;
      leftWrap.appendChild(mainSpan);

      var subSpan = document.createElement("span");
      subSpan.className = "sub";
      subSpan.textContent = m.subtitle || "";
      leftWrap.appendChild(subSpan);

      btn.appendChild(leftWrap);

      var tagSpan = document.createElement("span");
      tagSpan.className = "tag";
      tagSpan.textContent = m.tag || "Machine";
      btn.appendChild(tagSpan);

      btn.onclick = function () { selectMachine(m.id); };

      list.appendChild(btn);
    });
  }

  function selectMachine(machineId) {
    currentMachine = machines.find(function (m) { return m.id === machineId; });
    highlightMachine();
    resetSymptomAndWizard();

    if (!currentMachine) return;
    fetch(currentMachine.config).then(function (resp) {
      return resp.json();
    }).then(function (cfg) {
      currentMachine.configData = cfg;
      renderSymptoms();
      $("contextTitle").textContent = "2. Select symptom for " + (currentMachine.name || "");
      $("contextSubtitle").textContent = "Tap a symptom to start a guided troubleshooting flow.";
    }).catch(function () {
      $("symptomList").innerHTML = "<div style='font-size:12px;color:#fca5a5;'>Could not load machine data.</div>";
    });
  }

  function highlightMachine() {
    var list = $("machineList");
    var children = list.querySelectorAll(".machine-btn");
    for (var i = 0; i < children.length; i++) {
      var id = children[i].getAttribute("data-id");
      if (currentMachine && id === currentMachine.id) {
        children[i].classList.add("active");
      } else {
        children[i].classList.remove("active");
      }
    }
  }

  function resetSymptomAndWizard() {
    currentSymptom = null;
    currentStepId = null;
    stepHistory = [];
    $("symptomList").innerHTML = "";
    $("wizardStep").classList.remove("active");
  }

  function renderSymptoms() {
    var panel = $("symptomList");
    panel.innerHTML = "";
    if (!currentMachine || !currentMachine.configData || !currentMachine.configData.symptoms) {
      panel.innerHTML = "<div style='font-size:12px;color:#9ca3af;'>No symptom data for this machine.</div>";
      return;
    }
    currentMachine.configData.symptoms.forEach(function (s) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "symptom-btn";
      btn.setAttribute("data-id", s.id);

      var left = document.createElement("div");
      left.style.display = "flex";
      left.style.flexDirection = "column";

      var t = document.createElement("span");
      t.className = "title";
      t.textContent = s.name;
      left.appendChild(t);

      if (s.description) {
        var d = document.createElement("span");
        d.className = "desc";
        d.textContent = s.description;
        left.appendChild(d);
      }

      btn.appendChild(left);
      btn.onclick = function () { startSymptom(s.id); };

      panel.appendChild(btn);
    });
  }

  function startSymptom(symptomId) {
    if (!currentMachine || !currentMachine.configData) return;
    var s = (currentMachine.configData.symptoms || []).find(function (x) { return x.id === symptomId; });
    if (!s) return;
    currentSymptom = s;
    stepHistory = [];
    currentStepId = s.start;
    renderCurrentStep();
  }

  function renderCurrentStep() {
    if (!currentMachine || !currentSymptom || !currentMachine.configData) return;
    var steps = currentMachine.configData.steps || {};
    var step = steps[currentStepId];
    if (!step) return;

    $("wizardStep").classList.add("active");
    $("symptomList").style.display = "flex";

    var label = "Step " + (stepHistory.length + 1);
    $("stepLabel").textContent = label;
    $("stepText").textContent = step.text || "";
    $("stepNote").textContent = step.note || "";

    var resultBlock = $("resultBlock");
    var optionGrid = $("optionGrid");
    optionGrid.innerHTML = "";

    var isResult = !!step.result;
    if (isResult) {
      resultBlock.style.display = "block";
      $("resultTitle").textContent = step.result.title || "Summary";
      renderResultSection("resultLikely", "MOST LIKELY CAUSE", step.result.likelyCause);
      renderResultList("resultField", "FIELD FIX (WHAT TECHS ACTUALLY DO)", step.result.fieldFix);
      renderResultList("resultOfficial", "OFFICIAL / MANUAL STEPS", step.result.official);
      renderResultList("resultWarnings", "WARNINGS / SAFETY", step.result.warnings);

      addOptionButton(optionGrid, "Restart this symptom", "primary", function () {
        startSymptom(currentSymptom.id);
      });
      addOptionButton(optionGrid, "Choose another symptom", "secondary", function () {
        $("wizardStep").classList.remove("active");
        $("symptomList").style.display = "flex";
        currentSymptom = null;
        currentStepId = null;
        stepHistory = [];
      });
    } else {
      resultBlock.style.display = "none";
      var opts = step.options || [];
      if (!opts.length) {
        addOptionButton(optionGrid, "End", "primary", function () {});
      } else {
        for (var i = 0; i < opts.length; i++) {
          (function (opt) {
            var klass = opt.primary ? "primary" : "secondary";
            addOptionButton(optionGrid, opt.label, klass, function () {
              goToStep(opt.next);
            });
          })(opts[i]);
        }
      }
    }

    $("backStepBtn").disabled = stepHistory.length === 0;
    $("restartSymptomBtn").disabled = !currentSymptom;
  }

  function renderResultSection(elementId, title, text) {
    var el = $(elementId);
    if (!text) {
      el.innerHTML = "";
      el.style.display = "none";
      return;
    }
    el.style.display = "block";
    el.innerHTML = "<div class='result-section-title'>" + title + "</div><div style='font-size:12px;'>" + escapeHtml(text) + "</div>";
  }

  function renderResultList(elementId, title, arr) {
    var el = $(elementId);
    if (!arr || !arr.length) {
      el.innerHTML = "";
      el.style.display = "none";
      return;
    }
    var html = "<div class='result-section-title'>" + title + "</div><ul class='result-list'>";
    for (var i = 0; i < arr.length; i++) {
      html += "<li>" + escapeHtml(arr[i]) + "</li>";
    }
    html += "</ul>";
    el.style.display = "block";
    el.innerHTML = html;
  }

  function addOptionButton(container, label, style, onClick) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "option-btn " + (style || "");
    btn.textContent = label;
    btn.onclick = onClick;
    container.appendChild(btn);
  }

  function goToStep(nextId) {
    if (!currentMachine || !currentSymptom || !currentMachine.configData) return;
    if (!nextId) return;
    stepHistory.push(currentStepId);
    currentStepId = nextId;
    renderCurrentStep();
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function onBackStep() {
    if (!stepHistory.length) return;
    currentStepId = stepHistory.pop();
    renderCurrentStep();
  }

  function onRestartSymptom() {
    if (!currentSymptom) return;
    startSymptom(currentSymptom.id);
  }

  function init() {
    $("backStepBtn").onclick = onBackStep;
    $("restartSymptomBtn").onclick = onRestartSymptom;
    loadMachines();

    if ("serviceWorker" in navigator) {
      try {
        if (location.protocol === "http:" || location.protocol === "https:") {
          navigator.serviceWorker.register("service-worker.js").catch(function () {});
        }
      } catch (e) {}
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();