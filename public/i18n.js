(() => {
  const supported = ['de-DE', 'en-EN', 'fr-FR', 'es-ES'];
  const labels = {
    'de-DE': '🇩🇪 Deutsch',
    'en-EN': '🇬🇧 English',
    'fr-FR': '🇫🇷 Français',
    'es-ES': '🇪🇸 Español'
  };
  const dictionaries = {};
  const supplementalEntries = [
    ["Abenteuer & Kämpfe","Adventures & battles","Aventures et combats","Aventuras y combates"],
    ["Abenteuer abgeschlossen","Adventure completed","Aventure terminée","Aventura completada"],
    ["Abenteuer gesamt","Total adventures","Total des aventures","Aventuras totales"],
    ["Abenteuer mit Blutstein","Bloodstone adventures","Aventures avec pierre de sang","Aventuras con piedra de sangre"],
    ["Abenteuer-ID","Adventure ID","ID de l’aventure","ID de aventura"],
    ["Aktive Tränke","Active potions","Potions actives","Pociones activas"],
    ["Aktivität","Activity","Activité","Actividad"],
    ["Arbeit & Ressourcen","Work & resources","Travail et ressources","Trabajo y recursos"],
    ["Arbeit & Verkauf","Work & sales","Travail et ventes","Trabajo y ventas"],
    ["Arbeit begonnen oder abgeschlossen","Work started or completed","Travail commencé ou terminé","Trabajo iniciado o finalizado"],
    ["Arbeit gestartet","Work started","Travail commencé","Trabajo iniciado"],
    ["Arbeiten","Work","Travail","Trabajo"],
    ["Arbeitseinsätze","Work sessions","Sessions de travail","Sesiones de trabajo"],
    ["Arbeitsdauer in Stunden","Work duration in hours","Durée du travail en heures","Duración del trabajo en horas"],
    ["Arbeitszeit","Work time","Temps de travail","Tiempo de trabajo"],
    ["Ausrüstung & Inventar","Equipment & inventory","Équipement et inventaire","Equipo e inventario"],
    ["Automatisch Gold an die Gilde spenden","Automatically donate gold to the guild","Donner automatiquement de l’or à la guilde","Donar oro automáticamente al gremio"],
    ["Basiswert","Base value","Valeur de base","Valor base"],
    ["Begleiter-Ausrüstung","Companion equipment","Équipement des compagnons","Equipo de compañeros"],
    ["Begleiter-Prioritäten","Companion priorities","Priorités des compagnons","Prioridades de compañeros"],
    ["Begleiterausrüstung verbessert","Companion equipment improved","Équipement d’un compagnon amélioré","Equipo de compañero mejorado"],
    ["Beide Bereiche lassen sich unabhängig voneinander aktivieren.","Both sections can be enabled independently.","Les deux sections peuvent être activées indépendamment.","Ambas secciones pueden activarse de forma independiente."],
    ["Bilanz","Balance","Bilan","Balance"],
    ["Blutsteine ausgegeben","Bloodstones spent","Pierres de sang dépensées","Piedras de sangre gastadas"],
    ["Boni & Ausbaustufen","Bonuses & upgrade levels","Bonus et niveaux d’amélioration","Bonificaciones y niveles de mejora"],
    ["Bot gestartet oder gestoppt","Bot started or stopped","Bot démarré ou arrêté","Bot iniciado o detenido"],
    ["Botbetrieb","Bot operation","Fonctionnement du bot","Funcionamiento del bot"],
    ["Dauer","Duration","Durée","Duración"],
    ["Discord-Benachrichtigungen","Discord notifications","Notifications Discord","Notificaciones de Discord"],
    ["Discord-Webhook-URL","Discord webhook URL","URL du webhook Discord","URL del webhook de Discord"],
    ["Dungeon mit Blutstein","Bloodstone dungeon attempts","Donjons avec pierre de sang","Mazmorras con piedra de sangre"],
    ["Dungeon-/Kartenkämpfe","Dungeon/map battles","Combats de donjon/carte","Combates de mazmorra/mapa"],
    ["Dungeon-Gegner","Dungeon opponent","Adversaire du donjon","Oponente de mazmorra"],
    ["Dungeon-Niederlagen","Dungeon losses","Défaites en donjon","Derrotas en mazmorra"],
    ["Dungeon-Siege","Dungeon wins","Victoires en donjon","Victorias en mazmorra"],
    ["Eigener Rang","Your rank","Votre rang","Tu rango"],
    ["Eigener Status","Your status","Votre statut","Tu estado"],
    ["Ereignisbenachrichtigungen","Event notifications","Notifications d’événements","Notificaciones de eventos"],
    ["Erfolgreiche Aktionen","Successful actions","Actions réussies","Acciones correctas"],
    ["Festung","Fortress","Forteresse","Fortaleza"],
    ["Freier Platz","Empty slot","Emplacement libre","Espacio libre"],
    ["Freier Inventarplatz","Empty inventory slot","Emplacement d’inventaire libre","Espacio de inventario libre"],
    ["GILDE","GUILD","GUILDE","GREMIO"],
    ["Gesamtwert","Total value","Valeur totale","Valor total"],
    ["Gespendete Blutsteine","Donated bloodstones","Pierres de sang données","Piedras de sangre donadas"],
    ["Gespendetes Gold","Donated gold","Or donné","Oro donado"],
    ["Gildenausbauten","Guild upgrades","Améliorations de guilde","Mejoras del gremio"],
    ["Gildenausbauten automatisch verbessern","Automatically purchase guild upgrades","Acheter automatiquement les améliorations de guilde","Comprar automáticamente mejoras del gremio"],
    ["Gildenautomatik","Guild automation","Automatisation de la guilde","Automatización del gremio"],
    ["Gildengold","Guild gold","Or de guilde","Oro del gremio"],
    ["Gildenrang","Guild rank","Rang de guilde","Rango del gremio"],
    ["Gildenruhm","Guild fame","Renommée de guilde","Fama del gremio"],
    ["Gold aus Verkäufen","Gold from sales","Or des ventes","Oro de ventas"],
    ["Gold ausgegeben","Gold spent","Or dépensé","Oro gastado"],
    ["Gold durch Arbeit","Gold from work","Or du travail","Oro del trabajo"],
    ["Gold eingenommen","Gold earned","Or gagné","Oro obtenido"],
    ["Gold für Ausbauten","Gold for upgrades","Or pour les améliorations","Oro para mejoras"],
    ["Gold je Spende","Gold per donation","Or par don","Oro por donación"],
    ["Gold netto","Net gold","Or net","Oro neto"],
    ["Gold- und Blutsteinwarnungen","Gold and bloodstone warnings","Alertes d’or et de pierres de sang","Avisos de oro y piedras de sangre"],
    ["Goldreserve des Spielers","Player gold reserve","Réserve d’or du joueur","Reserva de oro del jugador"],
    ["Goldspenden","Gold donations","Dons d’or","Donaciones de oro"],
    ["Inventar verkaufen","Sell inventory","Vendre l’inventaire","Vender inventario"],
    ["Inventargegenstand verkauft","Inventory item sold","Objet d’inventaire vendu","Objeto del inventario vendido"],
    ["Inventarbelegung","Inventory capacity","Occupation de l’inventaire","Ocupación del inventario"],
    ["Inventarwarnung ab %","Inventory warning at %","Alerte d’inventaire à %","Aviso de inventario al %"],
    ["Keine","None","Aucun","Ninguno"],
    ["Keine aktuellen Gildenereignisse verfügbar","No recent guild events available","Aucun événement de guilde récent","No hay eventos recientes del gremio"],
    ["Keine Begleiterdaten verfügbar","No companion data available","Aucune donnée de compagnon disponible","No hay datos de compañeros disponibles"],
    ["Konstitution / Intelligenz","Constitution / intelligence","Constitution / intelligence","Constitución / inteligencia"],
    ["Kostenlose Abenteuer","Free adventures","Aventures gratuites","Aventuras gratuitas"],
    ["Kostenlose Dungeonversuche","Free dungeon attempts","Essais de donjon gratuits","Intentos gratuitos de mazmorra"],
    ["Kriegsbanner","War banner","Bannière de guerre","Estandarte de guerra"],
    ["Kritische Fehler","Critical errors","Erreurs critiques","Errores críticos"],
    ["Letzte Aktivität","Last activity","Dernière activité","Última actividad"],
    ["Letzte erfolgreiche Aktion","Last successful action","Dernière action réussie","Última acción correcta"],
    ["Levelaufstieg","Level up","Niveau supérieur","Subida de nivel"],
    ["Mauer","Wall","Muraille","Muralla"],
    ["Maximal erlaubter Attribut-Malus","Maximum allowed attribute penalty","Malus d’attribut maximal autorisé","Penalización máxima permitida"],
    ["Mitglied","Member","Membre","Miembro"],
    ["Mitglied beigetreten oder ausgetreten","Member joined or left","Membre arrivé ou parti","Miembro unido o salido"],
    ["Mitglieder","Members","Membres","Miembros"],
    ["Name","Name","Nom","Nombre"],
    ["Pausen","Pauses","Pauses","Pausas"],
    ["Pausendauer","Pause duration","Durée des pauses","Duración de pausas"],
    ["Priorität der Gildenausbauten","Guild upgrade priority","Priorité des améliorations de guilde","Prioridad de mejoras del gremio"],
    ["PvP-Erfolgsquote","PvP success rate","Taux de réussite JcJ","Tasa de éxito JcJ"],
    ["PvP-Kämpfe","PvP battles","Combats JcJ","Combates JcJ"],
    ["PvP-Niederlagen","PvP losses","Défaites JcJ","Derrotas JcJ"],
    ["PvP-Siege","PvP wins","Victoires JcJ","Victorias JcJ"],
    ["Reittier gewechselt","Mount changed","Monture changée","Montura cambiada"],
    ["Ruhezeit beginnt","Quiet hours start","Début des heures silencieuses","Inicio del horario silencioso"],
    ["Ruhezeit endet","Quiet hours end","Fin des heures silencieuses","Fin del horario silencioso"],
    ["Ruhezeit für nicht kritische Meldungen aktivieren","Enable quiet hours for non-critical messages","Activer les heures silencieuses pour les messages non critiques","Activar horario silencioso para mensajes no críticos"],
    ["Ruhm gewonnen / verloren","Fame gained / lost","Renommée gagnée / perdue","Fama ganada / perdida"],
    ["Schatzkammer","Treasury","Trésorerie","Tesorería"],
    ["Schwierigkeit","Difficulty","Difficulté","Dificultad"],
    ["Sitzung und Verbindung","Session and connection","Session et connexion","Sesión y conexión"],
    ["Sitzungsabbrüche / Neuverbindungen","Disconnects / reconnections","Déconnexions / reconnexions","Desconexiones / reconexiones"],
    ["Spieler","Player","Joueur","Jugador"],
    ["Spieler-Ausrüstung","Player equipment","Équipement du joueur","Equipo del jugador"],
    ["Spieler-Prioritäten","Player priorities","Priorités du joueur","Prioridades del jugador"],
    ["Spielerausrüstung verbessert","Player equipment improved","Équipement du joueur amélioré","Equipo del jugador mejorado"],
    ["Status","Status","Statut","Estado"],
    ["Beginn","Start","Début","Inicio"],
    ["Abgeschlossen","Completed","Terminé","Completado"],
    ["Läuft","Running","En cours","En curso"],
    ["Beendet","Finished","Terminé","Finalizado"],
    ["Geplant","Scheduled","Planifié","Programado"],
    ["Stärke / Geschick","Strength / dexterity","Force / dextérité","Fuerza / destreza"],
    ["System","System","Système","Sistema"],
    ["Tageslimit für Ausbauten","Daily upgrade limit","Limite quotidienne des améliorations","Límite diario de mejoras"],
    ["Tageslimit für Spenden","Daily donation limit","Limite quotidienne des dons","Límite diario de donaciones"],
    ["Tagesstatistik täglich um 12:00 Uhr senden","Send daily statistics at 12:00","Envoyer les statistiques quotidiennes à 12 h","Enviar estadísticas diarias a las 12:00"],
    ["Testnachricht senden","Send test message","Envoyer un message test","Enviar mensaje de prueba"],
    ["Trank abgelaufen","Potion expired","Potion expirée","Poción caducada"],
    ["Verbesserungen","Improvements","Améliorations","Mejoras"],
    ["Verkaufte Gegenstände","Items sold","Objets vendus","Objetos vendidos"],
    ["Wachturm","Watchtower","Tour de guet","Torre de vigilancia"],
    ["Warnung unter Blutsteinen","Warn below bloodstones","Alerte sous ce nombre de pierres de sang","Avisar por debajo de piedras de sangre"],
    ["Warnung unter Gold","Warn below gold","Alerte sous ce montant d’or","Avisar por debajo de oro"],
    ["Übersicht","Overview","Aperçu","Resumen"],
    ["Gold","Gold","Or","Oro"],
    ["REPORTS","REPORTS","RAPPORTS","INFORMES"],
    ["Dungeon","Dungeon","Donjon","Mazmorra"],
    ["ausklappen","expand","développer","expandir"],
    ["einklappen","collapse","réduire","contraer"],
    ["Ende","Ends","Fin","Fin"],
    ["Rang","Rank","Rang","Rango"],
    ["Bonus","Bonus","Bonus","Bonificación"],
    ["Priorität","Priority","Priorité","Prioridad"],
    ["Nächste Stufe:","Next level:","Niveau suivant :","Siguiente nivel:"],
    ["Online","Online","En ligne","En línea"],
    ["Gespeichert – für den laufenden Bot übernommen","Saved – applied to the running bot","Enregistré – appliqué au bot actif","Guardado – aplicado al bot activo"],
    ["Automatisches Arbeiten aktivieren","Enable automatic work","Activer le travail automatique","Activar trabajo automático"],
    ["Beispiel: 100 erlaubt Werte bis einschließlich −100.","Example: 100 allows values down to −100.","Exemple : 100 autorise les valeurs jusqu’à −100.","Ejemplo: 100 permite valores hasta −100."],
    ["Die Auswahl gilt getrennt für die Ausrüstung aller Begleiter.","The selection applies separately to all companion equipment.","La sélection s’applique séparément à l’équipement de chaque compagnon.","La selección se aplica por separado al equipo de cada compañero."],
    ["Begleiterprofile konnten nicht geladen werden","Companion profiles could not be loaded","Impossible de charger les profils des compagnons","No se pudieron cargar los perfiles de compañeros"],
    ["Inventar wird verkauft …","Selling inventory…","Vente de l’inventaire…","Vendiendo inventario…"],
    ["Wirklich alle Gegenstände im Spielerinventar verkaufen? Dieser Vorgang kann nicht rückgängig gemacht werden.","Sell every item in the player inventory? This action cannot be undone.","Vendre tous les objets de l’inventaire du joueur ? Cette action est irréversible.","¿Vender todos los objetos del inventario del jugador? Esta acción no se puede deshacer."],
    ["Arbeit startet nach drei PvP-Prüfungen ohne Kampf, wenn keine Abenteuer und keine Dungeonkämpfe verfügbar sind. Eine laufende Aufgabe wird niemals unterbrochen.","Work starts after three PvP checks without a fight when no adventures or dungeon battles are available. A running task is never interrupted.","Le travail commence après trois vérifications JcJ sans combat lorsqu’aucune aventure ni aucun combat de donjon n’est disponible. Une tâche en cours n’est jamais interrompue.","El trabajo comienza tras tres comprobaciones JcJ sin combate cuando no hay aventuras ni combates de mazmorra disponibles. Nunca se interrumpe una tarea activa."],
    ["Der Versand erfolgt nach deutscher Systemzeit. Die Webhook-URL wird nur lokal in config.json gespeichert und nicht in das Git-Repository aufgenommen.","Messages use German system time. The webhook URL is stored only in the local config.json and is not committed to Git.","Les envois utilisent l’heure système allemande. L’URL du webhook est enregistrée uniquement dans le fichier config.json local et n’est pas ajoutée à Git.","Los envíos usan la hora del sistema alemán. La URL del webhook se guarda solo en el archivo config.json local y no se añade a Git."],
    ["Es werden ausschließlich Ausbauten mit 0 Blutsteinkosten gekauft. Spielerreserve und Tageslimits werden vor jeder Aktion geprüft. Ein Tageslimit von 0 verhindert die jeweilige Aktion.","Only upgrades costing 0 bloodstones are purchased. Player reserve and daily limits are checked before every action. A daily limit of 0 prevents that action.","Seules les améliorations coûtant 0 pierre de sang sont achetées. La réserve du joueur et les limites quotidiennes sont vérifiées avant chaque action. Une limite de 0 empêche l’action.","Solo se compran mejoras que cuestan 0 piedras de sangre. La reserva del jugador y los límites diarios se comprueban antes de cada acción. Un límite de 0 impide la acción."],
    ["Werte von 0 deaktivieren die jeweilige Ressourcenwarnung. Sitzungs- und kritische Fehlerwarnungen werden auch während der Ruhezeit gesendet. Identische Meldungen werden für 30 Sekunden zusammengefasst.","A value of 0 disables the corresponding resource warning. Session and critical error warnings are sent during quiet hours. Identical messages are grouped for 30 seconds.","Une valeur de 0 désactive l’alerte de ressource correspondante. Les alertes de session et d’erreur critique sont envoyées pendant les heures silencieuses. Les messages identiques sont regroupés pendant 30 secondes.","Un valor de 0 desactiva el aviso de recursos correspondiente. Los avisos de sesión y errores críticos se envían durante el horario silencioso. Los mensajes idénticos se agrupan durante 30 segundos."]
    ,
    ["Schwierigkeit automatisch reduzieren, wenn nicht verfügbar","Automatically reduce difficulty when unavailable","Réduire automatiquement la difficulté si elle n’est pas disponible","Reducir automáticamente la dificultad si no está disponible"],
    ["Erzwungenen Kampf nach vier erfolglosen Suchgruppen aktivieren","Enable forced battle after four unsuccessful search groups","Activer le combat forcé après quatre groupes de recherche infructueux","Activar combate forzado tras cuatro grupos de búsqueda fallidos"],
    ["Wöchentliche Zusammenfassung montags um 12:05 Uhr senden","Send weekly summary on Mondays at 12:05","Envoyer le résumé hebdomadaire le lundi à 12 h 05","Enviar el resumen semanal los lunes a las 12:05"],
    ["Seltener Gegenstand gefunden","Rare item found","Objet rare trouvé","Objeto raro encontrado"],
    ["Tages- und Langzeitstatistiken","Daily and long-term statistics","Statistiques quotidiennes et à long terme","Estadísticas diarias y a largo plazo"],
    ["Woche","Week","Semaine","Semana"],
    ["Monat","Month","Mois","Mes"],
    ["Gesamte Laufzeit","All time","Toute la période","Todo el tiempo"],
    ["Bei einem Grenzwert von 57 werden alle Gegner bis einschließlich Level 56 berücksichtigt. Der optionale erzwungene Kampf ignoriert Level und Rang.","With a limit of 57, opponents up to level 56 are considered. The optional forced battle ignores level and rank.","Avec une limite de 57, les adversaires jusqu’au niveau 56 sont pris en compte. Le combat forcé facultatif ignore le niveau et le rang.","Con un límite de 57, se consideran oponentes hasta el nivel 56. El combate forzado opcional ignora el nivel y el rango."],
    ["Priorität der Gildenausbauten","Guild upgrade priority","Priorité des améliorations de guilde","Prioridad de mejoras del gremio"]
  ];
  let current = 'en-EN';
  let translating = false;

  const style = document.createElement('style');
  style.textContent = '.language-picker{position:relative;display:flex;align-items:center}.language-display{height:38px;min-width:142px;display:flex;align-items:center;justify-content:space-between;gap:9px;padding:0 10px;border:1px solid #72404a;border-radius:7px;background:#241216;color:#f5e9e9;font-weight:700}.language-display-main,.language-option{display:flex;align-items:center;gap:8px}.language-chevron{font-size:10px;color:#d8aeb3}.language-menu{position:absolute;top:calc(100% + 6px);right:0;z-index:100;width:174px;padding:5px;border:1px solid #72404a;border-radius:8px;background:#241216;box-shadow:0 12px 28px #000b}.language-menu[hidden]{display:none}.language-option{width:100%;padding:8px 9px;border-radius:5px;background:transparent;color:#f5e9e9;text-align:left}.language-option:hover,.language-option.active{background:#51242d}.language-flag{width:25px;height:17px;flex:0 0 auto;border-radius:2px;box-shadow:0 0 0 1px #ffffff35;overflow:hidden}.language-flag svg{display:block;width:100%;height:100%}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}@media(max-width:650px){.buttons{flex-wrap:wrap}.language-display{min-width:130px}}';
  document.head.append(style);

  const playerInformationLabel = [...document.querySelectorAll('.panel > .label')]
    .find(label => label.textContent.trim() === 'SPIELER & BOT-STATUS');
  if (playerInformationLabel) playerInformationLabel.textContent = 'SPIELERINFORMATIONEN';
  const companionsPanel = [...document.querySelectorAll('.panel')]
    .find(panel => panel.querySelector('.label')?.textContent.trim() === 'BEGLEITER');
  const guildPanel = document.getElementById('guildPanel');
  const dailyStatsPanel = document.getElementById('dailyStats');
  const reportsPanel = document.getElementById('reportsPanel');
  if (companionsPanel && guildPanel) companionsPanel.after(guildPanel);
  if (guildPanel && dailyStatsPanel) guildPanel.after(dailyStatsPanel);
  if (dailyStatsPanel && reportsPanel) dailyStatsPanel.after(reportsPanel);

  const picker = document.createElement('label');
  picker.className = 'language-picker';
  picker.innerHTML = '<span class="sr-only">Language</span><select id="languageSelect" class="sr-only" aria-label="Language"></select><button class="language-display" id="languageDisplay" type="button" aria-haspopup="listbox" aria-expanded="false"><span class="language-display-main"><span class="language-flag" id="selectedLanguageFlag"></span><span id="selectedLanguageName">English</span></span><span class="language-chevron">▼</span></button><div class="language-menu" id="languageMenu" role="listbox" hidden></div>';
  const select = picker.querySelector('select');
  for (const locale of supported) {
    const option = document.createElement('option');
    option.value = locale;
    option.textContent = labels[locale];
    select.append(option);
  }
  const flagSvg = locale => ({
    'de-DE':'<svg viewBox="0 0 30 20" aria-hidden="true"><path fill="#111" d="M0 0h30v7H0z"/><path fill="#d00" d="M0 7h30v6H0z"/><path fill="#ffce00" d="M0 13h30v7H0z"/></svg>',
    'en-EN':'<svg viewBox="0 0 30 20" aria-hidden="true"><path fill="#123b78" d="M0 0h30v20H0z"/><path stroke="#fff" stroke-width="5" d="M0 0l30 20M30 0L0 20"/><path stroke="#d22630" stroke-width="2" d="M0 0l30 20M30 0L0 20"/><path fill="#fff" d="M12 0h6v20h-6zM0 7h30v6H0z"/><path fill="#d22630" d="M13.5 0h3v20h-3zM0 8.5h30v3H0z"/></svg>',
    'fr-FR':'<svg viewBox="0 0 30 20" aria-hidden="true"><path fill="#143c8c" d="M0 0h10v20H0z"/><path fill="#fff" d="M10 0h10v20H10z"/><path fill="#ed2939" d="M20 0h10v20H20z"/></svg>',
    'es-ES':'<svg viewBox="0 0 30 20" aria-hidden="true"><path fill="#aa151b" d="M0 0h30v5H0zM0 15h30v5H0z"/><path fill="#f1bf00" d="M0 5h30v10H0z"/></svg>'
  })[locale];
  const languageMenu = picker.querySelector('#languageMenu');
  const languageDisplay = picker.querySelector('#languageDisplay');
  for (const locale of supported) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'language-option';
    item.dataset.locale = locale;
    item.setAttribute('role', 'option');
    item.innerHTML = `<span class="language-flag">${flagSvg(locale)}</span><span>${labels[locale].replace(/^\S+\s/, '')}</span>`;
    item.addEventListener('click', () => {
      select.value = locale;
      select.dispatchEvent(new Event('change', { bubbles: true }));
      languageMenu.hidden = true;
      languageDisplay.setAttribute('aria-expanded', 'false');
    });
    languageMenu.append(item);
  }
  languageDisplay.addEventListener('click', () => {
    languageMenu.hidden = !languageMenu.hidden;
    languageDisplay.setAttribute('aria-expanded', String(!languageMenu.hidden));
  });
  document.querySelector('.buttons')?.append(picker);

  const nativeNumberFormat = Intl.NumberFormat;
  Intl.NumberFormat = class extends nativeNumberFormat {
    constructor(locales, options) { super(window.uiLocale || locales, options); }
  };
  const nativeLocaleString = Date.prototype.toLocaleString;
  const nativeLocaleTimeString = Date.prototype.toLocaleTimeString;
  Date.prototype.toLocaleString = function(locales, options) { return nativeLocaleString.call(this, window.uiLocale || locales, options); };
  Date.prototype.toLocaleTimeString = function(locales, options) { return nativeLocaleTimeString.call(this, window.uiLocale || locales, options); };

  function canonicalFor(value) {
    const clean = String(value || '').trim();
    if (!clean) return null;
    for (const dictionary of Object.values(dictionaries)) {
      for (const [source, translated] of Object.entries(dictionary)) {
        if (clean === source || clean === translated) return source;
      }
    }
    return null;
  }

  function translateValue(value) {
    const original = String(value || '');
    const clean = original.trim();
    if (!clean) return original;
    const source = canonicalFor(clean);
    const translated = source ? (dictionaries[current]?.[source] ?? source) : null;
    if (source) {
      const leading = original.match(/^\s*/)?.[0] || '';
      const trailing = original.match(/\s*$/)?.[0] || '';
      return leading + translated + trailing;
    }
    const occupiedSource = 'belegt';
    const occupiedVariants = [occupiedSource, ...Object.values(dictionaries).map(dict => dict[occupiedSource]).filter(Boolean)];
    for (const variant of occupiedVariants) {
      if (clean.endsWith(' ' + variant)) return clean.slice(0, -variant.length) + (dictionaries[current]?.[occupiedSource] || occupiedSource);
    }
    const prefixes = ['Level ', 'Aktualisiert: ', 'Inventar ', 'Freier Inventarplatz ', 'Ende ', 'Rang ', 'Bonus ', 'Priorität ', 'Nächste Stufe: ', 'Dungeon-Gegner '];
    for (const prefix of prefixes) {
      const canonicalPrefix = canonicalFor(prefix.trim()) || prefix.trim();
      const variants = [prefix.trim(), ...Object.values(dictionaries).map(dict => dict[canonicalPrefix]).filter(Boolean)];
      const matched = variants.find(variant => clean.startsWith(variant + ' '));
      if (matched) {
        let result = (dictionaries[current]?.[canonicalPrefix] || canonicalPrefix) + clean.slice(matched.length);
        const occupiedSource = 'belegt';
        const occupiedVariants = [occupiedSource, ...Object.values(dictionaries).map(dict => dict[occupiedSource]).filter(Boolean)];
        for (const variant of occupiedVariants) if (result.endsWith(variant)) result = result.slice(0, -variant.length) + (dictionaries[current]?.[occupiedSource] || occupiedSource);
        return result;
      }
    }
    for (const word of ['ausklappen', 'einklappen']) {
      const variants = [word, ...Object.values(dictionaries).map(dictionary => dictionary[word]).filter(Boolean)];
      const matched = variants.find(variant => clean.endsWith(' ' + variant));
      if (!matched) continue;
      const base = clean.slice(0, -(matched.length + 1));
      const baseSource = canonicalFor(base);
      const translatedBase = baseSource ? (dictionaries[current]?.[baseSource] || baseSource) : base;
      return translatedBase + ' ' + (dictionaries[current]?.[word] || word);
    }
    if (clean.startsWith('● ')) return '● ' + (dictionaries[current]?.Online || 'Online');
    const onlineVariants = ['online', ...Object.values(dictionaries).map(dictionary => dictionary.Online).filter(Boolean)];
    const onlineSuffix = onlineVariants.find(variant => clean.toLocaleLowerCase().endsWith(' ' + String(variant).toLocaleLowerCase()));
    if (onlineSuffix) return clean.slice(0, -(onlineSuffix.length)) + (dictionaries[current]?.Online || 'Online');
    return original;
  }

  function translateTree(root = document.body) {
    if (translating || !root) return;
    translating = true;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      if (node.parentElement?.closest('#logs, .equipment-tooltip span')) continue;
      const value = translateValue(node.nodeValue);
      if (value !== node.nodeValue) node.nodeValue = value;
    }
    for (const element of root.querySelectorAll?.('[aria-label],[title]') || []) {
      for (const attribute of ['aria-label', 'title']) {
        if (!element.hasAttribute(attribute)) continue;
        const value = translateValue(element.getAttribute(attribute));
        if (value && value !== element.getAttribute(attribute)) element.setAttribute(attribute, value);
      }
    }
    translating = false;
  }

  async function setLocale(locale, persist = true) {
    if (!supported.includes(locale)) locale = 'en-EN';
    current = locale;
    window.uiLocale = locale;
    document.documentElement.lang = locale;
    select.value = locale;
    picker.querySelector('#selectedLanguageFlag').innerHTML = flagSvg(locale);
    picker.querySelector('#selectedLanguageName').textContent = labels[locale].replace(/^\S+\s/, '');
    picker.querySelectorAll('.language-option').forEach(option => {
      const active = option.dataset.locale === locale;
      option.classList.toggle('active', active);
      option.setAttribute('aria-selected', String(active));
    });
    translateTree();
    for (const [id, source] of [['startButton', 'Starten'], ['stopButton', 'Stoppen']]) {
      const button = document.getElementById(id);
      if (button) button.textContent = dictionaries[current]?.[source] || source;
    }
    if (persist) {
      const response = await fetch('/api/locale', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ locale }) });
      if (!response.ok) throw new Error(`Language HTTP ${response.status}`);
    }
    window.dispatchEvent(new CustomEvent('tanoth-locale-change', { detail: { locale } }));
  }

  select.addEventListener('change', () => setLocale(select.value).catch(error => {
    const message = document.getElementById('message');
    if (message) message.textContent = error.message;
  }));

  Promise.all(supported.map(async locale => {
    const response = await fetch(`/locales/${locale}.json`, { cache: 'no-store' });
    dictionaries[locale] = response.ok ? await response.json() : {};
    const column = { 'de-DE': 0, 'en-EN': 1, 'fr-FR': 2, 'es-ES': 3 }[locale];
    for (const entry of supplementalEntries) dictionaries[locale][entry[0]] = entry[column];
  })).then(async () => {
    const response = await fetch('/api/locale', { cache: 'no-store' });
    const settings = response.ok ? await response.json() : { locale: 'en-EN' };
    await setLocale(settings.locale || 'en-EN', false);
    const observer = new MutationObserver(records => {
      if (translating) return;
      for (const record of records) {
        if (record.type === 'characterData') translateTree(record.target.parentElement);
        for (const node of record.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) translateTree(node);
          else if (node.nodeType === Node.TEXT_NODE) translateTree(node.parentElement);
        }
        if (record.type === 'attributes') translateTree(record.target);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['aria-label', 'title'] });
  });
})();
