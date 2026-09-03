let rootDirHandle = null;
let undoHistory = [];

// ==========================================
// 0. Localization
const STATUS_LABELS = {
    en: { syntax: 'SYNTAX', warn: 'WARN', same: 'SAME', diff: 'DIFF', new: 'NEW', mod: 'MOD' },
    es: { syntax: 'SINTAXIS', warn: 'AVISO', same: 'IGUAL', diff: 'DIFF', new: 'NUEVO', mod: 'MOD' },
    pt: { syntax: 'SINTAXE', warn: 'AVISO', same: 'IGUAL', diff: 'DIFF', new: 'NOVO', mod: 'MOD' },
    fr: { syntax: 'SYNTAXE', warn: 'AVERT.', same: 'IDENTIQUE', diff: 'DIFF', new: 'NOUVEAU', mod: 'MOD' },
    pl: { syntax: 'SKŁADNIA', warn: 'UWAGA', same: 'TAKI SAM', diff: 'DIFF', new: 'NOWY', mod: 'MOD' },
    be: { syntax: 'СІНТАКСІС', warn: 'УВАГА', same: 'ТОЙ ЖА', diff: 'DIFF', new: 'НОВЫ', mod: 'ЗМЕНЕНЫ' },
    uk: { syntax: 'СИНТАКСИС', warn: 'УВАГА', same: 'БЕЗ ЗМІН', diff: 'DIFF', new: 'НОВИЙ', mod: 'ЗМІНЕНО' },
    zh: { syntax: '语法', warn: '警告', same: '相同', diff: '差异', new: '新增', mod: '修改' },
    ja: { syntax: '構文', warn: '警告', same: '同一', diff: '差分', new: '新規', mod: '変更' },
    ru: { syntax: 'СИНТАКСИС', warn: 'ВНИМАНИЕ', same: 'БЕЗ ИЗМЕНЕНИЙ', diff: 'РАЗНИЦА', new: 'НОВЫЙ', mod: 'ИЗМЕНЁН' },
    ar: { syntax: 'بنية', warn: 'تحذير', same: 'مطابق', diff: 'فرق', new: 'جديد', mod: 'معدّل' },
    hi: { syntax: 'सिंटैक्स', warn: 'चेतावनी', same: 'समान', diff: 'अंतर', new: 'नया', mod: 'संशोधित' },
    ur: { syntax: 'نحو', warn: 'انتباہ', same: 'یکساں', diff: 'فرق', new: 'نیا', mod: 'ترمیم شدہ' },
    bn: { syntax: 'সিনট্যাক্স', warn: 'সতর্কতা', same: 'একই', diff: 'পার্থক্য', new: 'নতুন', mod: 'পরিবর্তিত' },
    id: { syntax: 'SINTAKS', warn: 'PERINGATAN', same: 'SAMA', diff: 'DIFF', new: 'BARU', mod: 'DIUBAH' },
    de: { syntax: 'SYNTAX', warn: 'WARNUNG', same: 'GLEICH', diff: 'DIFF', new: 'NEU', mod: 'GEÄNDERT' },
    tr: { syntax: 'SÖZDİZİMİ', warn: 'UYARI', same: 'AYNI', diff: 'FARK', new: 'YENİ', mod: 'DEĞİŞTİ'
    }
};
const DIFF_ERROR_LABELS = { en: 'DIFF ERR', es: 'ERROR DIFF', pt: 'ERRO DIFF', fr: 'ERREUR DIFF', pl: 'BŁĄD DIFF', be: 'ПАМЫЛКА DIFF', uk: 'ПОМИЛКА DIFF', zh: 'DIFF 错误', ja: 'DIFF エラー', ru: 'ОШИБКА DIFF', ar: 'خطأ DIFF', hi: 'DIFF त्रुटि', ur: 'DIFF خرابی', bn: 'DIFF ত্রুটি', id: 'EROR DIFF', de: 'DIFF-FEHLER', tr: 'DIFF HATASI' };
// ==========================================

const I18N = {
    en: {
        connectRoot: 'Connect Project Root', change: 'Change', regrant: 'Re-grant',
        noFolder: 'No folder connected', undo: 'Undo', context: 'Context',
        packContext: 'Pack Codebase Context', diffInstructions: 'Insert Diff Format Instructions',
        directoryTree: 'Insert Directory Tree', attachFile: 'Attach Local File',
        visualDiff: 'Visual Diff', editCode: 'Edit Code', filesToSync: 'Files to Sync',
        selected: 'selected', cancel: 'Cancel', skipAll: 'Skip All', requestFull: 'Request Full File/Diff',
        syncSelected: 'Sync {count} Selected File(s)', diffMerged: 'Diff Merged', noChanges: 'No Changes',
        excerpt: 'EXCERPT', excerptDetected: 'EXCERPT DETECTED:', excerptHelp: 'This block appears to be partial code and is excluded from syncing by default. Request the complete file or a SEARCH/REPLACE patch before saving.',
        diffError: 'Diff Error:', diffErrorHelp: 'Nothing from this patch will be written. Request a corrected diff, or use "Edit Code" to make a complete-file edit manually.',
        syntaxIssues: 'Syntax Issues:', placeholders: 'Placeholders Detected:',
        searchFiles: 'Search files...', excludeGlobs: 'Exclude globs (e.g. *.test.ts, docs/*)', applyGlobs: 'Apply Globs',
        expandAll: 'Expand All', collapseAll: 'Collapse All', selectAll: 'Select All', deselectAll: 'Deselect All',
        folderStructure: 'Folder & File Structure (Sorted from Max Tokens)', tokensUsage: 'Tokens & Usage %', size: 'Size',
        noMatchingFiles: 'No files matching filter.', copyContext: 'Copy Context XML', insertContext: 'Insert Context (~{tokens}) into Prompt',
        syncToDisk: 'Sync to Disk', writing: 'Writing {count} file(s)...', upToDate: 'Up to Date', synced: 'Synced {written}/{total}',
        saved: 'Saved', skipped: 'Skipped', error: 'Error', sync: 'Sync',
        connectFirst: 'Connect your project folder first!', noValidFiles: 'No files with valid paths detected.',
        undoNone: 'Nothing to undo.', reverted: '↩️ Reverted {count} file(s) to previous state.',
        appendedRules: 'Appended sync format rules to prompt!', restored: 'Restored connection to {name}',
        connected: 'Connected to {name}', reconnected: 'Re-connected to {name}',
        scanning: 'Scanning codebase & parsing recursive .gitignore rules...', noSource: 'No source files found after applying gitignore.',
        packingFailed: 'Context packing failed: {error}', generatingTree: 'Generating directory tree...',
        treeAdded: 'Directory tree added to prompt!', treeFailed: 'Tree generation failed: {error}',
        filePathPrompt: 'Enter relative path to attach (e.g. src/index.ts):', fileNotFound: 'File not found: {path}',
        attached: 'Attached {path} to prompt!', readFailed: 'Failed to read file: {error}',
        excluded: 'Excluded {count} file(s) matching custom pattern(s)', copied: '📋 Codebase context copied to clipboard!',
        packed: '📥 Packed codebase context ({count} files) into prompt attachment!', skippedPrompt: '{count} file(s) skipped and appended to prompt.',
        syncSuccess: 'Successfully synced {count} file(s)!', syncError: 'Sync error: {error}', writeFailed: 'Write failed: {error}',
        syncTitle: 'Sync {path} to disk', drag: 'Drag to reposition',
        diffPrompt: 'The response for "{path}" was marked as an excerpt. Please provide either the complete file or a precise SEARCH/REPLACE patch.'
    },
    es: {
        connectRoot: 'Conectar raíz del proyecto', change: 'Cambiar', regrant: 'Conceder de nuevo', noFolder: 'Ninguna carpeta conectada', undo: 'Deshacer', context: 'Contexto', packContext: 'Empaquetar contexto del código', diffInstructions: 'Insertar instrucciones de formato diff', directoryTree: 'Insertar árbol de directorios', attachFile: 'Adjuntar archivo local', visualDiff: 'Diff visual', editCode: 'Editar código', filesToSync: 'Archivos para sincronizar', selected: 'seleccionados', cancel: 'Cancelar', skipAll: 'Omitir todo', requestFull: 'Solicitar archivo/diff completo', syncSelected: 'Sincronizar {count} archivo(s) seleccionado(s)', diffMerged: 'Diff combinado', noChanges: 'Sin cambios', excerpt: 'FRAGMENTO', excerptDetected: 'FRAGMENTO DETECTADO:', excerptHelp: 'Este bloque parece código parcial y se excluye por defecto. Solicita el archivo completo o un parche SEARCH/REPLACE antes de guardarlo.', diffError: 'Error de diff:', diffErrorHelp: 'No se escribirá nada de este parche. Solicita un diff corregido o usa «Editar código» para editar el archivo completo.', syntaxIssues: 'Problemas de sintaxis:', placeholders: 'Marcadores detectados:', searchFiles: 'Buscar archivos...', excludeGlobs: 'Excluir patrones (p. ej. *.test.ts, docs/*)', applyGlobs: 'Aplicar patrones', expandAll: 'Expandir todo', collapseAll: 'Contraer todo', selectAll: 'Seleccionar todo', deselectAll: 'Deseleccionar todo', folderStructure: 'Estructura de carpetas y archivos (ordenada por tokens)', tokensUsage: 'Tokens y uso %', size: 'Tamaño', noMatchingFiles: 'No hay archivos que coincidan.', copyContext: 'Copiar XML del contexto', insertContext: 'Insertar contexto (~{tokens}) en el prompt', syncToDisk: 'Sincronizar con disco', writing: 'Escribiendo {count} archivo(s)...', upToDate: 'Actualizado', synced: 'Sincronizados {written}/{total}', saved: 'Guardado', skipped: 'Omitido', error: 'Error', sync: 'Sincronizar', connectFirst: '¡Conecta primero la carpeta del proyecto!', noValidFiles: 'No se detectaron archivos con rutas válidas.', undoNone: 'Nada que deshacer.', reverted: '↩️ Se revirtieron {count} archivo(s) al estado anterior.', appendedRules: '¡Reglas de formato añadidas al prompt!', restored: 'Conexión restaurada con {name}', connected: 'Conectado a {name}', reconnected: 'Conexión restablecida con {name}', scanning: 'Analizando el código y las reglas .gitignore recursivas...', noSource: 'No se encontraron archivos fuente tras aplicar gitignore.', packingFailed: 'Error al empaquetar el contexto: {error}', generatingTree: 'Generando árbol de directorios...', treeAdded: '¡Árbol de directorios añadido al prompt!', treeFailed: 'Error al generar el árbol: {error}', filePathPrompt: 'Introduce la ruta relativa que quieres adjuntar (p. ej. src/index.ts):', fileNotFound: 'Archivo no encontrado: {path}', attached: '¡{path} adjuntado al prompt!', readFailed: 'Error al leer el archivo: {error}', excluded: 'Se excluyeron {count} archivo(s) según los patrones', copied: '📋 ¡Contexto del código copiado al portapapeles!', packed: '📥 ¡Contexto empaquetado ({count} archivos) como adjunto del prompt!', skippedPrompt: 'Se omitieron {count} archivo(s) y se añadieron al prompt.', syncSuccess: '¡{count} archivo(s) sincronizado(s) correctamente!', syncError: 'Error de sincronización: {error}', writeFailed: 'Error de escritura: {error}', syncTitle: 'Sincronizar {path} con el disco', drag: 'Arrastra para cambiar de posición', diffPrompt: 'La respuesta para «{path}» se marcó como fragmento. Proporciona el archivo completo o un parche SEARCH/REPLACE preciso.'
    },
    pt: {
        connectRoot: 'Conectar raiz do projeto', change: 'Alterar', regrant: 'Conceder novamente', noFolder: 'Nenhuma pasta conectada', undo: 'Desfazer', context: 'Contexto', packContext: 'Empacotar contexto da base de código', diffInstructions: 'Inserir instruções de formato diff', directoryTree: 'Inserir árvore de diretórios', attachFile: 'Anexar arquivo local', visualDiff: 'Diff visual', editCode: 'Editar código', filesToSync: 'Arquivos para sincronizar', selected: 'selecionados', cancel: 'Cancelar', skipAll: 'Ignorar tudo', requestFull: 'Solicitar arquivo/diff completo', syncSelected: 'Sincronizar {count} arquivo(s) selecionado(s)', diffMerged: 'Diff mesclado', noChanges: 'Sem alterações', excerpt: 'TRECHO', excerptDetected: 'TRECHO DETECTADO:', excerptHelp: 'Este bloco parece ser código parcial e é excluído por padrão. Solicite o arquivo completo ou um patch SEARCH/REPLACE antes de salvar.', diffError: 'Erro de diff:', diffErrorHelp: 'Nada deste patch será gravado. Solicite um diff corrigido ou use “Editar código” para editar o arquivo completo.', syntaxIssues: 'Problemas de sintaxe:', placeholders: 'Marcadores detectados:', searchFiles: 'Pesquisar arquivos...', excludeGlobs: 'Excluir padrões (ex.: *.test.ts, docs/*)', applyGlobs: 'Aplicar padrões', expandAll: 'Expandir tudo', collapseAll: 'Recolher tudo', selectAll: 'Selecionar tudo', deselectAll: 'Desmarcar tudo', folderStructure: 'Estrutura de pastas e arquivos (ordenada por tokens)', tokensUsage: 'Tokens e uso %', size: 'Tamanho', noMatchingFiles: 'Nenhum arquivo corresponde ao filtro.', copyContext: 'Copiar XML do contexto', insertContext: 'Inserir contexto (~{tokens}) no prompt', syncToDisk: 'Sincronizar com disco', writing: 'Gravando {count} arquivo(s)...', upToDate: 'Atualizado', synced: 'Sincronizados {written}/{total}', saved: 'Salvo', skipped: 'Ignorado', error: 'Erro', sync: 'Sincronizar', connectFirst: 'Conecte primeiro a pasta do projeto!', noValidFiles: 'Nenhum arquivo com caminho válido foi detectado.', undoNone: 'Nada para desfazer.', reverted: '↩️ {count} arquivo(s) revertido(s) ao estado anterior.', appendedRules: 'Regras de formato adicionadas ao prompt!', restored: 'Conexão restaurada com {name}', connected: 'Conectado a {name}', reconnected: 'Reconectado a {name}', scanning: 'Analisando a base de código e regras .gitignore recursivas...', noSource: 'Nenhum arquivo de código encontrado após aplicar o gitignore.', packingFailed: 'Falha ao empacotar o contexto: {error}', generatingTree: 'Gerando árvore de diretórios...', treeAdded: 'Árvore de diretórios adicionada ao prompt!', treeFailed: 'Falha ao gerar a árvore: {error}', filePathPrompt: 'Digite o caminho relativo para anexar (ex.: src/index.ts):', fileNotFound: 'Arquivo não encontrado: {path}', attached: '{path} anexado ao prompt!', readFailed: 'Falha ao ler o arquivo: {error}', excluded: '{count} arquivo(s) excluído(s) pelos padrões', copied: '📋 Contexto da base de código copiado para a área de transferência!', packed: '📥 Contexto empacotado ({count} arquivos) inserido como anexo no prompt!', skippedPrompt: '{count} arquivo(s) ignorado(s) e adicionado(s) ao prompt.', syncSuccess: '{count} arquivo(s) sincronizado(s) com sucesso!', syncError: 'Erro de sincronização: {error}', writeFailed: 'Falha ao gravar: {error}', syncTitle: 'Sincronizar {path} com o disco', drag: 'Arraste para reposicionar', diffPrompt: 'A resposta para “{path}” foi marcada como trecho. Forneça o arquivo completo ou um patch SEARCH/REPLACE preciso.'
    },
    fr: {}, pl: {}, be: {}, uk: {}, zh: {}, ja: {}, ru: {}, ar: {}, hi: {}, ur: {}, bn: {}, id: {}, de: {}, tr: {}
};

// Locale aliases follow the browser's regional language tag.
const LOCALE_ALIASES = { 'pt-BR': 'pt', 'zh-CN': 'zh', 'zh-TW': 'zh', 'be-BY': 'be', 'uk-UA': 'uk', 'ru-RU': 'ru', 'ar-SA': 'ar', 'hi-IN': 'hi', 'ur-PK': 'ur', 'bn-BD': 'bn', 'id-ID': 'id', 'de-DE': 'de', 'tr-TR': 'tr', 'es-ES': 'es', 'fr-FR': 'fr', 'pl-PL': 'pl', 'ja-JP': 'ja' };
const EXTRA_TRANSLATIONS = {
    en: { statusSyntax: 'SYNTAX', statusWarn: 'WARN', statusSame: 'SAME', statusDiff: 'DIFF', statusNew: 'NEW', statusMod: 'MOD', undoFailed: 'Failed to undo: {error}', requestedFull: 'Requested complete output for {path}', allUpToDate: 'All files are already up to date!' },
    es: { statusSyntax: 'SINTAXIS', statusWarn: 'AVISO', statusSame: 'IGUAL', statusDiff: 'DIFF', statusNew: 'NUEVO', statusMod: 'MOD', undoFailed: 'Error al deshacer: {error}', requestedFull: 'Salida completa solicitada para {path}', allUpToDate: 'Todos los archivos ya están actualizados.' },
    pt: { statusSyntax: 'SINTAXE', statusWarn: 'AVISO', statusSame: 'IGUAL', statusDiff: 'DIFF', statusNew: 'NOVO', statusMod: 'MOD', undoFailed: 'Falha ao desfazer: {error}', requestedFull: 'Saída completa solicitada para {path}', allUpToDate: 'Todos os arquivos já estão atualizados.' },
    fr: { statusSyntax: 'SYNTAXE', statusWarn: 'AVERT.', statusSame: 'IDENTIQUE', statusDiff: 'DIFF', statusNew: 'NOUVEAU', statusMod: 'MODIFIÉ', undoFailed: 'Annulation impossible : {error}', requestedFull: 'Sortie complète demandée pour {path}', allUpToDate: 'Tous les fichiers sont déjà à jour.' },
    pl: { statusSyntax: 'SKŁADNIA', statusWarn: 'UWAGA', statusSame: 'TAKI SAM', statusDiff: 'DIFF', statusNew: 'NOWY', statusMod: 'ZMIENIONY', undoFailed: 'Nie można cofnąć: {error}', requestedFull: 'Zażądano pełnej zawartości dla {path}', allUpToDate: 'Wszystkie pliki są już aktualne.' },
    be: { statusSyntax: 'СІНТАКСІС', statusWarn: 'УВАГА', statusSame: 'БЕЗ ЗМЕН', statusDiff: 'DIFF', statusNew: 'НОВЫ', statusMod: 'ЗМЕНЕНЫ', undoFailed: 'Не ўдалося адмяніць: {error}', requestedFull: 'Запытана поўная версія {path}', allUpToDate: 'Усе файлы ўжо актуальныя.' },
    uk: { statusSyntax: 'СИНТАКСИС', statusWarn: 'УВАГА', statusSame: 'БЕЗ ЗМІН', statusDiff: 'DIFF', statusNew: 'НОВИЙ', statusMod: 'ЗМІНЕНО', undoFailed: 'Не вдалося скасувати: {error}', requestedFull: 'Запитано повний вміст для {path}', allUpToDate: 'Усі файли вже актуальні.' },
    zh: { statusSyntax: '语法', statusWarn: '警告', statusSame: '相同', statusDiff: '差异', statusNew: '新增', statusMod: '已修改', undoFailed: '撤销失败：{error}', requestedFull: '已请求 {path} 的完整内容', allUpToDate: '所有文件均已是最新版本。' },
    ja: { statusSyntax: '構文', statusWarn: '警告', statusSame: '同一', statusDiff: '差分', statusNew: '新規', statusMod: '変更済み', undoFailed: '元に戻せませんでした：{error}', requestedFull: '{path} の完全な出力を要求しました', allUpToDate: 'すべてのファイルは最新です。' },
    ru: { statusSyntax: 'СИНТАКСИС', statusWarn: 'ВНИМАНИЕ', statusSame: 'БЕЗ ИЗМЕНЕНИЙ', statusDiff: 'РАЗНИЦА', statusNew: 'НОВЫЙ', statusMod: 'ИЗМЕНЁН', undoFailed: 'Не удалось отменить: {error}', requestedFull: 'Запрошен полный вывод для {path}', allUpToDate: 'Все файлы уже актуальны.' },
    ar: { statusSyntax: 'بنية', statusWarn: 'تحذير', statusSame: 'مطابق', statusDiff: 'فرق', statusNew: 'جديد', statusMod: 'معدّل', undoFailed: 'تعذر التراجع: {error}', requestedFull: 'تم طلب الإخراج الكامل لـ {path}', allUpToDate: 'جميع الملفات محدثة بالفعل.' },
    hi: { statusSyntax: 'सिंटैक्स', statusWarn: 'चेतावनी', statusSame: 'समान', statusDiff: 'अंतर', statusNew: 'नया', statusMod: 'संशोधित', undoFailed: 'पूर्ववत नहीं किया जा सका: {error}', requestedFull: '{path} का पूरा आउटपुट माँगा गया', allUpToDate: 'सभी फ़ाइलें पहले से अद्यतन हैं।' },
    ur: { statusSyntax: 'نحو', statusWarn: 'انتباہ', statusSame: 'یکساں', statusDiff: 'فرق', statusNew: 'نیا', statusMod: 'ترمیم شدہ', undoFailed: 'واپس نہیں ہو سکا: {error}', requestedFull: '{path} کے مکمل آؤٹ پٹ کی درخواست کی گئی', allUpToDate: 'تمام فائلیں پہلے ہی تازہ ترین ہیں۔' },
    bn: { statusSyntax: 'সিনট্যাক্স', statusWarn: 'সতর্কতা', statusSame: 'একই', statusDiff: 'পার্থক্য', statusNew: 'নতুন', statusMod: 'পরিবর্তিত', undoFailed: 'পূর্বাবস্থায় ফেরানো যায়নি: {error}', requestedFull: '{path}-এর সম্পূর্ণ আউটপুট চাওয়া হয়েছে', allUpToDate: 'সব ফাইল ইতিমধ্যে সর্বশেষ অবস্থায় আছে।' },
    id: { statusSyntax: 'SINTAKS', statusWarn: 'PERINGATAN', statusSame: 'SAMA', statusDiff: 'DIFF', statusNew: 'BARU', statusMod: 'DIUBAH', undoFailed: 'Gagal membatalkan: {error}', requestedFull: 'Output lengkap untuk {path} diminta', allUpToDate: 'Semua file sudah terbaru.' },
    de: { statusSyntax: 'SYNTAX', statusWarn: 'WARNUNG', statusSame: 'GLEICH', statusDiff: 'DIFF', statusNew: 'NEU', statusMod: 'GEÄNDERT', undoFailed: 'Rückgängigmachen fehlgeschlagen: {error}', requestedFull: 'Vollständige Ausgabe für {path} angefordert', allUpToDate: 'Alle Dateien sind bereits aktuell.' },
    tr: { statusSyntax: 'SÖZDİZİMİ', statusWarn: 'UYARI', statusSame: 'AYNI', statusDiff: 'FARK', statusNew: 'YENİ', statusMod: 'DEĞİŞTİ', undoFailed: 'Geri alma başarısız: {error}', requestedFull: '{path} için tam çıktı istendi', allUpToDate: 'Tüm dosyalar zaten güncel.' }
};
Object.keys(EXTRA_TRANSLATIONS).forEach(locale => Object.assign(I18N[locale] || (I18N[locale] = {}), EXTRA_TRANSLATIONS[locale]));
const CORE_UI_TRANSLATIONS = {
    fr: { connectRoot: 'Connecter la racine du projet', undo: 'Annuler', context: 'Contexte', packContext: 'Emballer le contexte du code', diffInstructions: 'Insérer les instructions de format diff', directoryTree: 'Insérer l’arborescence', attachFile: 'Joindre un fichier local', visualDiff: 'Diff visuel', editCode: 'Modifier le code', filesToSync: 'Fichiers à synchroniser', cancel: 'Annuler', skipAll: 'Tout ignorer', searchFiles: 'Rechercher des fichiers…', applyGlobs: 'Appliquer les motifs', expandAll: 'Tout développer', collapseAll: 'Tout réduire', selectAll: 'Tout sélectionner', deselectAll: 'Tout désélectionner', copyContext: 'Copier le XML du contexte', syncToDisk: 'Synchroniser sur le disque', connectFirst: 'Connectez d’abord le dossier du projet !' },
    pl: { connectRoot: 'Połącz katalog główny projektu', undo: 'Cofnij', context: 'Kontekst', packContext: 'Spakuj kontekst kodu', diffInstructions: 'Wstaw instrukcje formatu diff', directoryTree: 'Wstaw drzewo katalogów', attachFile: 'Dołącz plik lokalny', visualDiff: 'Wizualny diff', editCode: 'Edytuj kod', filesToSync: 'Pliki do synchronizacji', cancel: 'Anuluj', skipAll: 'Pomiń wszystko', searchFiles: 'Szukaj plików…', applyGlobs: 'Zastosuj wzorce', expandAll: 'Rozwiń wszystko', collapseAll: 'Zwiń wszystko', selectAll: 'Zaznacz wszystko', deselectAll: 'Odznacz wszystko', copyContext: 'Kopiuj XML kontekstu', syncToDisk: 'Synchronizuj z dyskiem', connectFirst: 'Najpierw połącz folder projektu!' },
    be: { connectRoot: 'Падключыць корань праекта', undo: 'Адмяніць', context: 'Кантэкст', packContext: 'Упакаваць кантэкст кода', diffInstructions: 'Уставіць інструкцыі фармату diff', directoryTree: 'Уставіць дрэва каталогаў', attachFile: 'Далучыць лакальны файл', visualDiff: 'Візуальны diff', editCode: 'Рэдагаваць код', filesToSync: 'Файлы для сінхранізацыі', cancel: 'Скасаваць', skipAll: 'Прапусціць усё', searchFiles: 'Пошук файлаў…', applyGlobs: 'Ужыць шаблоны', expandAll: 'Разгарнуць усё', collapseAll: 'Згарнуць усё', selectAll: 'Выбраць усё', deselectAll: 'Зняць выбар', copyContext: 'Скапіяваць XML кантэксту', syncToDisk: 'Сінхранізаваць з дыскам', connectFirst: 'Спачатку падключыце папку праекта!' },
    uk: { connectRoot: 'Підключити корінь проєкту', undo: 'Скасувати', context: 'Контекст', packContext: 'Упакувати контекст коду', diffInstructions: 'Вставити інструкції формату diff', directoryTree: 'Вставити дерево каталогів', attachFile: 'Долучити локальний файл', visualDiff: 'Візуальний diff', editCode: 'Редагувати код', filesToSync: 'Файли для синхронізації', cancel: 'Скасувати', skipAll: 'Пропустити все', searchFiles: 'Пошук файлів…', applyGlobs: 'Застосувати шаблони', expandAll: 'Розгорнути все', collapseAll: 'Згорнути все', selectAll: 'Вибрати все', deselectAll: 'Зняти вибір', copyContext: 'Копіювати XML контексту', syncToDisk: 'Синхронізувати з диском', connectFirst: 'Спочатку підключіть папку проєкту!' },
    ru: { connectRoot: 'Подключить корень проекта', undo: 'Отменить', context: 'Контекст', packContext: 'Упаковать контекст кода', diffInstructions: 'Вставить инструкции формата diff', directoryTree: 'Вставить дерево каталогов', attachFile: 'Прикрепить локальный файл', visualDiff: 'Визуальная разница', editCode: 'Редактировать код', filesToSync: 'Файлы для синхронизации', cancel: 'Отмена', skipAll: 'Пропустить всё', searchFiles: 'Поиск файлов…', applyGlobs: 'Применить шаблоны', expandAll: 'Развернуть всё', collapseAll: 'Свернуть всё', selectAll: 'Выбрать всё', deselectAll: 'Снять выбор', copyContext: 'Копировать XML контекста', syncToDisk: 'Синхронизировать с диском', connectFirst: 'Сначала подключите папку проекта!' },
    de: { connectRoot: 'Projektstamm verbinden', undo: 'Rückgängig', context: 'Kontext', packContext: 'Code-Kontext packen', diffInstructions: 'Diff-Format-Anweisungen einfügen', directoryTree: 'Verzeichnisbaum einfügen', attachFile: 'Lokale Datei anhängen', visualDiff: 'Visueller Diff', editCode: 'Code bearbeiten', filesToSync: 'Zu synchronisierende Dateien', cancel: 'Abbrechen', skipAll: 'Alle überspringen', searchFiles: 'Dateien suchen…', applyGlobs: 'Muster anwenden', expandAll: 'Alle erweitern', collapseAll: 'Alle reduzieren', selectAll: 'Alle auswählen', deselectAll: 'Auswahl aufheben', copyContext: 'Kontext-XML kopieren', syncToDisk: 'Mit Datenträger synchronisieren', connectFirst: 'Bitte zuerst den Projektordner verbinden!' },
    tr: { connectRoot: 'Proje kökünü bağla', undo: 'Geri al', context: 'Bağlam', packContext: 'Kod tabanı bağlamını paketle', diffInstructions: 'Diff biçimi talimatlarını ekle', directoryTree: 'Dizin ağacını ekle', attachFile: 'Yerel dosya ekle', visualDiff: 'Görsel diff', editCode: 'Kodu düzenle', filesToSync: 'Senkronize edilecek dosyalar', cancel: 'İptal', skipAll: 'Tümünü atla', searchFiles: 'Dosyalarda ara…', applyGlobs: 'Kalıpları uygula', expandAll: 'Tümünü genişlet', collapseAll: 'Tümünü daralt', selectAll: 'Tümünü seç', deselectAll: 'Seçimi kaldır', copyContext: 'Bağlam XML’ini kopyala', syncToDisk: 'Diskle senkronize et', connectFirst: 'Önce proje klasörünü bağlayın!' }
};
Object.assign(CORE_UI_TRANSLATIONS, {
    zh: { connectRoot: '连接项目根目录', undo: '撤销', context: '上下文', packContext: '打包代码库上下文', diffInstructions: '插入 Diff 格式说明', directoryTree: '插入目录树', attachFile: '附加本地文件', visualDiff: '可视化 Diff', editCode: '编辑代码', filesToSync: '待同步文件', cancel: '取消', skipAll: '全部跳过', searchFiles: '搜索文件…', applyGlobs: '应用匹配规则', expandAll: '全部展开', collapseAll: '全部折叠', selectAll: '全选', deselectAll: '取消全选', copyContext: '复制上下文 XML', syncToDisk: '同步到磁盘', connectFirst: '请先连接项目文件夹！' },
    ja: { connectRoot: 'プロジェクトルートを接続', undo: '元に戻す', context: 'コンテキスト', packContext: 'コードベースのコンテキストをパック', diffInstructions: 'Diff 形式の指示を挿入', directoryTree: 'ディレクトリツリーを挿入', attachFile: 'ローカルファイルを添付', visualDiff: 'ビジュアル Diff', editCode: 'コードを編集', filesToSync: '同期するファイル', cancel: 'キャンセル', skipAll: 'すべてスキップ', searchFiles: 'ファイルを検索…', applyGlobs: 'パターンを適用', expandAll: 'すべて展開', collapseAll: 'すべて折りたたむ', selectAll: 'すべて選択', deselectAll: '選択を解除', copyContext: 'コンテキスト XML をコピー', syncToDisk: 'ディスクに同期', connectFirst: '先にプロジェクトフォルダーを接続してください！' },
    id: { connectRoot: 'Hubungkan root proyek', undo: 'Urungkan', context: 'Konteks', packContext: 'Kemas konteks basis kode', diffInstructions: 'Sisipkan instruksi format diff', directoryTree: 'Sisipkan pohon direktori', attachFile: 'Lampirkan file lokal', visualDiff: 'Diff visual', editCode: 'Edit kode', filesToSync: 'File untuk disinkronkan', cancel: 'Batal', skipAll: 'Lewati semua', searchFiles: 'Cari file…', applyGlobs: 'Terapkan pola', expandAll: 'Perluas semua', collapseAll: 'Ciutkan semua', selectAll: 'Pilih semua', deselectAll: 'Batalkan semua pilihan', copyContext: 'Salin XML konteks', syncToDisk: 'Sinkronkan ke disk', connectFirst: 'Hubungkan folder proyek terlebih dahulu!' },
    ar: { connectRoot: 'توصيل جذر المشروع', undo: 'تراجع', context: 'السياق', packContext: 'حزم سياق قاعدة الشفرة', diffInstructions: 'إدراج تعليمات تنسيق diff', directoryTree: 'إدراج شجرة المجلدات', attachFile: 'إرفاق ملف محلي', visualDiff: 'Diff مرئي', editCode: 'تحرير الشفرة', filesToSync: 'الملفات المطلوب مزامنتها', cancel: 'إلغاء', skipAll: 'تخطي الكل', searchFiles: 'البحث عن ملفات…', applyGlobs: 'تطبيق الأنماط', expandAll: 'توسيع الكل', collapseAll: 'طي الكل', selectAll: 'تحديد الكل', deselectAll: 'إلغاء تحديد الكل', copyContext: 'نسخ XML السياق', syncToDisk: 'مزامنة مع القرص', connectFirst: 'يرجى توصيل مجلد المشروع أولاً!' },
    hi: { connectRoot: 'प्रोजेक्ट रूट कनेक्ट करें', undo: 'पूर्ववत करें', context: 'कॉन्टेक्स्ट', packContext: 'कोडबेस कॉन्टेक्स्ट पैक करें', diffInstructions: 'Diff फ़ॉर्मैट निर्देश डालें', directoryTree: 'डायरेक्टरी ट्री डालें', attachFile: 'स्थानीय फ़ाइल संलग्न करें', visualDiff: 'विज़ुअल Diff', editCode: 'कोड संपादित करें', filesToSync: 'सिंक की जाने वाली फ़ाइलें', cancel: 'रद्द करें', skipAll: 'सब छोड़ें', searchFiles: 'फ़ाइलें खोजें…', applyGlobs: 'पैटर्न लागू करें', expandAll: 'सब फैलाएँ', collapseAll: 'सब समेटें', selectAll: 'सब चुनें', deselectAll: 'चयन हटाएँ', copyContext: 'कॉन्टेक्स्ट XML कॉपी करें', syncToDisk: 'डिस्क से सिंक करें', connectFirst: 'पहले प्रोजेक्ट फ़ोल्डर कनेक्ट करें!' },
    ur: { connectRoot: 'پروجیکٹ روٹ مربوط کریں', undo: 'واپس کریں', context: 'سیاق', packContext: 'کوڈ بیس سیاق پیک کریں', diffInstructions: 'Diff فارمیٹ ہدایات داخل کریں', directoryTree: 'ڈائریکٹری ٹری داخل کریں', attachFile: 'مقامی فائل منسلک کریں', visualDiff: 'بصری Diff', editCode: 'کوڈ میں ترمیم کریں', filesToSync: 'ہم وقت ہونے والی فائلیں', cancel: 'منسوخ', skipAll: 'سب چھوڑیں', searchFiles: 'فائلیں تلاش کریں…', applyGlobs: 'پیٹرن لاگو کریں', expandAll: 'سب پھیلائیں', collapseAll: 'سب سمیٹیں', selectAll: 'سب منتخب کریں', deselectAll: 'انتخاب ختم کریں', copyContext: 'سیاق XML نقل کریں', syncToDisk: 'ڈسک سے ہم وقت کریں', connectFirst: 'پہلے پروجیکٹ فولڈر کو مربوط کریں!' },
    bn: { connectRoot: 'প্রকল্পের রুট সংযুক্ত করুন', undo: 'পূর্বাবস্থায় ফেরান', context: 'প্রসঙ্গ', packContext: 'কোডবেসের প্রসঙ্গ প্যাক করুন', diffInstructions: 'Diff ফরম্যাটের নির্দেশনা যোগ করুন', directoryTree: 'ডিরেক্টরি ট্রি যোগ করুন', attachFile: 'স্থানীয় ফাইল সংযুক্ত করুন', visualDiff: 'ভিজ্যুয়াল Diff', editCode: 'কোড সম্পাদনা করুন', filesToSync: 'সিঙ্ক করার ফাইল', cancel: 'বাতিল', skipAll: 'সব বাদ দিন', searchFiles: 'ফাইল খুঁজুন…', applyGlobs: 'প্যাটার্ন প্রয়োগ করুন', expandAll: 'সব প্রসারিত করুন', collapseAll: 'সব গুটিয়ে নিন', selectAll: 'সব নির্বাচন করুন', deselectAll: 'নির্বাচন বাতিল করুন', copyContext: 'প্রসঙ্গ XML কপি করুন', syncToDisk: 'ডিস্কে সিঙ্ক করুন', connectFirst: 'প্রথমে প্রকল্প ফোল্ডার সংযুক্ত করুন!' }
});
Object.keys(CORE_UI_TRANSLATIONS).forEach(locale => Object.assign(I18N[locale], CORE_UI_TRANSLATIONS[locale]));
Object.keys(I18N).forEach(locale => Object.keys(I18N.en).forEach(key => { if (!(key in I18N[locale])) I18N[locale][key] = I18N.en[key]; }));
const LANGUAGE = ((typeof navigator !== 'undefined' && navigator.language) || 'en').replace('_', '-');
const LOCALE = LOCALE_ALIASES[LANGUAGE] || LANGUAGE.split('-')[0];
function t(key, vars = {}) {
    if (key === 'statusDiffError') return DIFF_ERROR_LABELS[LOCALE] || DIFF_ERROR_LABELS.en;
    const statusKey = { statusSyntax: 'syntax', statusWarn: 'warn', statusSame: 'same', statusDiff: 'diff', statusNew: 'new', statusMod: 'mod' }[key];
    const text = statusKey
        ? (STATUS_LABELS[LOCALE] || STATUS_LABELS.en)[statusKey]
        : ((I18N[LOCALE] && I18N[LOCALE][key]) || I18N.en[key] || key);
    return text.replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? ''));
}

const AI_STUDIO_SELECTORS = Object.freeze({
    promptInput: 'textarea[placeholder*="prompt" i], textarea[placeholder*="Ask" i], ms-autosize-textarea textarea, textarea.mat-mdc-input-element, textarea',
    editablePrompt: 'div[contenteditable="true"]'
});

const DB_NAME = 'ai_studio_sync_db';
const STORE_NAME = 'handles';

// ==========================================
// 1. IndexedDB Directory Handle Persistence
// ==========================================

function openHandleDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
            req.result.createObjectStore(STORE_NAME);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function saveStoredHandle(handle) {
    try {
        const db = await openHandleDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(handle, 'rootDir');
        return new Promise((resolve) => {
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => resolve(false);
        });
    } catch {
        return false;
    }
}

async function getStoredHandle() {
    try {
        const db = await openHandleDB();
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get('rootDir');
        return new Promise((resolve) => {
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => resolve(null);
        });
    } catch {
        return null;
    }
}

// ==========================================
// 2. Toast Notification System
// ==========================================

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function showToast(message, type = 'info', duration = 3500) {
    let container = document.getElementById('ai-sync-toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'ai-sync-toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `ai-sync-toast ai-sync-toast-${type}`;
    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️';
    toast.innerHTML = `<span>${icon}</span><span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('ai-sync-toast-fade');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

const STRICT_SYNC_FORMAT_PROMPT = `Return code changes as one canonical git unified diff in a single SIX-backtick Markdown fence.

Rules:
- Use repository-relative paths in every \`diff --git a/path b/path\`, \`---\`, and \`+++\` header.
- Include enough unchanged context for every hunk to match the current file exactly.
- For a new file, use \`--- /dev/null\` and \`+++ b/relative/path\`.
- The outer fence must open with exactly six backticks plus \`diff\`, and close with exactly six backticks. This prevents backticks inside Markdown files from breaking the diff block.
- Do not put prose, excerpts, placeholders, or unchanged complete files inside the diff fence.
- Never escape or reformat file contents to make them look nicer in Markdown.

Example:
\`\`\`\`\`\`diff
diff --git a/src/example.js b/src/example.js
--- a/src/example.js
+++ b/src/example.js
@@ -1,1 +1,1 @@
-const oldValue = true;
+const newValue = true;
\`\`\`\`\`\``;

async function insertStrictSyncFormatPrompt() {
    await insertIntoPrompt(STRICT_SYNC_FORMAT_PROMPT);
    showToast(t('appendedRules'), 'success');
}

// ==========================================
// 3. File System Operations & Traversal
// ==========================================

function getPathParts(relativePath) {
    const cleanPath = relativePath.replace(/^[\\\/]+/, '').replace(/[\\\/]+$/, '');
    const parts = cleanPath.split(/[\\\/]/).filter(p => p.length > 0 && p !== '.');
    if (parts.includes('..')) {
        throw new Error("Path contains '..' traversal which is blocked for safety.");
    }
    return parts;
}

async function readRelativeFile(dirHandle, relativePath) {
    try {
        const parts = getPathParts(relativePath);
        const fileName = parts.pop();
        let currentDir = dirHandle;

        for (const part of parts) {
            currentDir = await currentDir.getDirectoryHandle(part, { create: false });
        }

        const fileHandle = await currentDir.getFileHandle(fileName, { create: false });
        const file = await fileHandle.getFile();
        return await file.text();
    } catch (err) {
        if (err.name === 'NotFoundError') {
            return null;
        }
        throw err;
    }
}

async function writeRelativeFile(dirHandle, relativePath, content) {
    const parts = getPathParts(relativePath);
    const fileName = parts.pop();
    let currentDir = dirHandle;

    for (const part of parts) {
        currentDir = await currentDir.getDirectoryHandle(part, { create: true });
    }

    const fileHandle = await currentDir.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
}

async function deleteRelativeFile(dirHandle, relativePath) {
    const parts = getPathParts(relativePath);
    const fileName = parts.pop();
    let currentDir = dirHandle;

    for (const part of parts) {
        currentDir = await currentDir.getDirectoryHandle(part, { create: false });
    }

    try {
        await currentDir.removeEntry(fileName);
    } catch (err) {
        if (err.name !== 'NotFoundError') throw err;
    }
}

// ==========================================
// 4. Undo History Engine
// ==========================================

function updateUndoButtonState() {
    const undoBtn = document.getElementById('btn-undo-sync');
    if (undoBtn) {
        undoBtn.disabled = undoHistory.length === 0;
        undoBtn.title = undoHistory.length > 0 ? `${t('undo')} (${undoHistory.length})` : t('undoNone');
    }
}

async function recordUndoSnapshot(dirHandle, fileEntries) {
    const items = [];
    for (const entry of fileEntries) {
        const prevContent = await readRelativeFile(dirHandle, entry.filePath);
        items.push({
            filePath: entry.filePath,
            prevContent,
            existed: prevContent !== null
        });
    }
    undoHistory.push({ timestamp: Date.now(), items });
    updateUndoButtonState();
}

async function performUndo(dirHandle) {
    if (undoHistory.length === 0) {
        showToast(t('undoNone'), 'warning');
        return;
    }
    const lastAction = undoHistory.pop();
    updateUndoButtonState();

    let revertedCount = 0;
    try {
        for (const item of lastAction.items) {
            if (item.existed && item.prevContent !== null) {
                await writeRelativeFile(dirHandle, item.filePath, item.prevContent);
                revertedCount++;
            } else {
                await deleteRelativeFile(dirHandle, item.filePath);
                revertedCount++;
            }
        }
        showToast(t('reverted', { count: revertedCount }), 'success');
    } catch (err) {
        showToast(t('undoFailed', { error: err.message }), 'error');
    }
}

// ==========================================
// 5. Diff Engine & Prefix/Suffix Trimmed LCS Diff
// ==========================================

function isSearchReplaceDiff(text) {
    return /^<{7}\s*SEARCH\r?\n[\s\S]*?\r?\n={7}\r?\n[\s\S]*?\r?\n>{7}\s*REPLACE/m.test(text);
}

function isUnifiedDiff(text) {
    return (
        /^diff --git\s+/m.test(text) ||
        /^@@\s+-\d+(?:,\d+)?\s+\+\d+(?:,\d+)?\s+@@/m.test(text) ||
        (/^--- (?:a\/|\/dev\/null|[^\r\n]+)/m.test(text) && /^\+\+\+ (?:b\/|[^\r\n]+)/m.test(text))
    );
}

function isDiffContent(text) {
    return isSearchReplaceDiff(text) || isUnifiedDiff(text);
}

function applySearchReplace(original, patch) {
    const blockRegex = /^<{7}\s*SEARCH\r?\n([\s\S]*?)\r?\n={7}\r?\n([\s\S]*?)\r?\n>{7}\s*REPLACE/gim;
    let match;
    let updated = original;
    let replacedCount = 0;

    while ((match = blockRegex.exec(patch)) !== null) {
        const searchBlock = match[1];
        const replaceBlock = match[2];

        if (updated.includes(searchBlock)) {
            updated = updated.replace(searchBlock, replaceBlock);
            replacedCount++;
            continue;
        }

        const origLines = updated.split(/\r?\n/);
        const searchLines = searchBlock.split(/\r?\n/).map(l => l.trimEnd());
        let foundIdx = -1;

        for (let i = 0; i <= origLines.length - searchLines.length; i++) {
            let matches = true;
            for (let j = 0; j < searchLines.length; j++) {
                if (origLines[i + j].trimEnd() !== searchLines[j]) {
                    matches = false;
                    break;
                }
            }
            if (matches) {
                foundIdx = i;
                break;
            }
        }

        if (foundIdx !== -1) {
            const replaceLines = replaceBlock.split(/\r?\n/);
            origLines.splice(foundIdx, searchLines.length, ...replaceLines);
            updated = origLines.join('\n');
            replacedCount++;
        } else {
            throw new Error(`Search block could not be matched in original file:\n"${searchBlock.slice(0, 80)}..."`);
        }
    }

    if (replacedCount === 0) {
        throw new Error('No valid SEARCH/REPLACE blocks found.');
    }
    return updated;
}

function applyUnifiedPatch(original, patch) {
    const lines = stripOuterMarkdownFence(patch).split(/\r?\n/);
    const normalizedOriginal = original.replace(/\r\n/g, '\n');
    const originalHadFinalNewline = normalizedOriginal.endsWith('\n');
    const origLines = normalizedOriginal === '' ? [] : normalizedOriginal.split('\n');
    if (originalHadFinalNewline) origLines.pop();
    const hunks = [];
    let currentHunk = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const hunkMatch = line.match(/^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/);

        if (hunkMatch) {
            if (currentHunk) hunks.push(currentHunk);
            currentHunk = {
                oldStart: parseInt(hunkMatch[1], 10),
                oldCount: hunkMatch[2] === undefined ? 1 : parseInt(hunkMatch[2], 10),
                newCount: hunkMatch[4] === undefined ? 1 : parseInt(hunkMatch[4], 10),
                lines: []
            };
        } else if (currentHunk) {
            if (line === '\\ No newline at end of file') continue;
            if (!/^[+\- ]/.test(line)) continue;
            currentHunk.lines.push(line);
        }
    }
    if (currentHunk) hunks.push(currentHunk);

    if (hunks.length === 0) {
        throw new Error('No valid patch hunks found in unified diff.');
    }

    let resultLines = [...origLines];

    for (let h = hunks.length - 1; h >= 0; h--) {
        const hunk = hunks[h];
        const oldLines = [];
        const newLines = [];
        let contextLineCount = 0;

        for (const line of hunk.lines) {
            const marker = line[0];
            const content = line.slice(1);
            if (marker === '-') oldLines.push(content);
            else if (marker === '+') newLines.push(content);
            else if (marker === ' ') {
                oldLines.push(content);
                newLines.push(content);
                contextLineCount++;
            }
        }

        const oldCountDrift = oldLines.length - hunk.oldCount;
        const newCountDrift = newLines.length - hunk.newCount;
        const countsMatch = oldCountDrift === 0 && newCountDrift === 0;
        const safelyRepairableCounts = contextLineCount > 0 && oldCountDrift === newCountDrift;

        // Hunk counts are metadata; the old-side body matching the real file is
        // authoritative. Gemini commonly miscounts by one when it includes or
        // omits a context line. Only tolerate symmetric drift, which preserves
        // the declared old/new line delta. Asymmetric drift remains malformed.
        if (!countsMatch && !safelyRepairableCounts) {
            throw new Error(
                `Malformed unified diff hunk near line ${hunk.oldStart}: ` +
                `header expects ${hunk.oldCount}/${hunk.newCount} old/new lines, ` +
                `but the body contains ${oldLines.length}/${newLines.length}.`
            );
        }

        const expectedIdx = Math.max(0, hunk.oldStart ? hunk.oldStart - 1 : 0);
        const matchesAt = (idx) => {
            if (idx < 0 || idx + oldLines.length > resultLines.length) return false;
            for (let j = 0; j < oldLines.length; j++) {
                if (resultLines[idx + j].trimEnd() !== oldLines[j].trimEnd()) return false;
            }
            return true;
        };

        let foundIdx = matchesAt(expectedIdx) ? expectedIdx : -1;
        if (foundIdx === -1) {
            const candidates = [];
            for (let idx = 0; idx <= resultLines.length - oldLines.length; idx++) {
                if (matchesAt(idx)) candidates.push(idx);
            }
            if (candidates.length > 1) {
                throw new Error(
                    `Unified diff hunk near line ${hunk.oldStart} is ambiguous ` +
                    `(${candidates.length} matching locations). Request more unchanged context.`
                );
            }
            if (candidates.length === 1) foundIdx = candidates[0];
        }

        if (foundIdx !== -1) {
            resultLines.splice(foundIdx, oldLines.length, ...newLines);
        } else {
            throw new Error(`Unified diff hunk near line ${hunk.oldStart} could not be aligned.`);
        }
    }

    const shouldHaveFinalNewline = normalizedOriginal === '' || originalHadFinalNewline;
    return resultLines.join('\n') + (shouldHaveFinalNewline && resultLines.length > 0 ? '\n' : '');
}

function processDiffOrDirectContent(originalContent, newContent) {
    if (!isDiffContent(newContent)) {
        return { isDiff: false, content: newContent };
    }
    if (isUnifiedDiff(newContent) && /^\+\+\+ \/dev\/null\s*$/m.test(newContent)) {
        throw new Error('File deletion diffs are not supported. Delete the file manually.');
    }
    if (originalContent === null && !(isUnifiedDiff(newContent) && /^--- \/dev\/null\s*$/m.test(newContent))) {
        throw new Error('Diff received, but target file does not exist locally.');
    }
    if (isSearchReplaceDiff(newContent)) {
        return { isDiff: true, content: applySearchReplace(originalContent, newContent) };
    }
    return { isDiff: true, content: applyUnifiedPatch(originalContent || '', newContent) };
}

function computeLineDiff(oldText, newText) {
    const oldNorm = (oldText || '').replace(/\r\n/g, '\n');
    const newNorm = (newText || '').replace(/\r\n/g, '\n');

    const oldLines = oldNorm.split('\n');
    const newLines = newNorm.split('\n');

    if (oldText !== null && oldNorm === newNorm) {
        return oldLines.map((line, i) => ({
            type: 'unchanged',
            text: line,
            oldLine: i + 1,
            newLine: i + 1
        }));
    }

    let start = 0;
    const minLen = Math.min(oldLines.length, newLines.length);
    while (start < minLen && oldLines[start] === newLines[start]) {
        start++;
    }

    let oldEnd = oldLines.length - 1;
    let newEnd = newLines.length - 1;
    while (oldEnd >= start && newEnd >= start && oldLines[oldEnd] === newLines[newEnd]) {
        oldEnd--;
        newEnd--;
    }

    const prefix = [];
    for (let i = 0; i < start; i++) {
        prefix.push({ type: 'unchanged', text: oldLines[i], oldLine: i + 1, newLine: i + 1 });
    }

    const suffix = [];
    const suffixCount = oldLines.length - 1 - oldEnd;
    for (let i = 0; i < suffixCount; i++) {
        const oIdx = oldEnd + 1 + i;
        const nIdx = newEnd + 1 + i;
        suffix.push({ type: 'unchanged', text: oldLines[oIdx], oldLine: oIdx + 1, newLine: nIdx + 1 });
    }

    const midOld = oldLines.slice(start, oldEnd + 1);
    const midNew = newLines.slice(start, newEnd + 1);

    const n = midOld.length;
    const m = midNew.length;
    const middle = [];

    if (n > 0 && m === 0) {
        for (let i = 0; i < n; i++) {
            middle.push({ type: 'removed', text: midOld[i], oldLine: start + 1 + i });
        }
    } else if (n === 0 && m > 0) {
        for (let j = 0; j < m; j++) {
            middle.push({ type: 'added', text: midNew[j], newLine: start + 1 + j });
        }
    } else if (n > 0 && m > 0) {
        const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < m; j++) {
                if (midOld[i] === midNew[j]) {
                    dp[i + 1][j + 1] = dp[i][j] + 1;
                } else {
                    dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
                }
            }
        }

        let i = n, j = m;
        const subDiff = [];
        while (i > 0 || j > 0) {
            if (i > 0 && j > 0 && midOld[i - 1] === midNew[j - 1]) {
                subDiff.unshift({
                    type: 'unchanged',
                    text: midOld[i - 1],
                    oldLine: start + i,
                    newLine: start + j
                });
                i--; j--;
            } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
                subDiff.unshift({
                    type: 'added',
                    text: midNew[j - 1],
                    newLine: start + j
                });
                j--;
            } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
                subDiff.unshift({
                    type: 'removed',
                    text: midOld[i - 1],
                    oldLine: start + i
                });
                i--;
            }
        }
        middle.push(...subDiff);
    }

    return [...prefix, ...middle, ...suffix];
}

// ==========================================
// 6. Safe Validation & Format-Aware Placeholders
// ==========================================

function checkPlaceholders(filePath, content) {
    const extMatch = filePath.match(/\.([a-zA-Z0-9_-]+)$/);
    const ext = extMatch ? `.${extMatch[1].toLowerCase()}` : '';

    if (['.md', '.markdown', '.txt', '.rst', '.json', '.csv', '.tsv'].includes(ext)) {
        return [];
    }

    const warnings = [];
    const lines = content.split(/\r?\n/);

    const standaloneEllipsis = /^\s*(?:\/\/|#|\/\*|<!--)\s*(?:\.\.\.|…)\s*(?:\*\/|-->)?\s*$/;
    const dedicatedTruncationComment = /^\s*(?:\/\/|#|\/\*|<!--)\s*(?:\.\.\.\s*(?:existing|rest of|remaining|other|unchanged)|(?:existing|remaining|unchanged|previous)\s+code\s+(?:remains|stays|goes here)|code\s+remains\s+unchanged|TODO:\s*implement)/i;

    lines.forEach((line, idx) => {
        const trimmed = line.trim();
        if (standaloneEllipsis.test(trimmed) || dedicatedTruncationComment.test(trimmed)) {
            warnings.push(`Line ${idx + 1}: Placeholder detected ("${trimmed.slice(0, 60)}")`);
        }
    });
    return warnings;
}

function validateContent(filePath, content) {
    const warnings = checkPlaceholders(filePath, content);
    const issues = [];
    const extMatch = filePath.match(/\.([a-zA-Z0-9_-]+)$/);
    const ext = extMatch ? `.${extMatch[1].toLowerCase()}` : '';

    if (ext === '.json') {
        try {
            JSON.parse(content);
        } catch (e) {
            issues.push(`JSON Syntax Error: ${e.message}`);
        }
    } else if (['.html', '.htm', '.xml', '.svg'].includes(ext)) {
        try {
            const parser = new DOMParser();
            const mime = (ext === '.xml' || ext === '.svg') ? 'application/xml' : 'text/html';
            const doc = parser.parseFromString(content, mime);
            const parseErr = doc.querySelector('parsererror');
            if (parseErr) {
                issues.push(`Markup Syntax: ${parseErr.textContent.slice(0, 80)}`);
            }
        } catch (e) {
            issues.push(`Markup Error: ${e.message}`);
        }
    }

    return {
        valid: issues.length === 0 && warnings.length === 0,
        hasIssues: issues.length > 0,
        issues,
        warnings
    };
}

// ==========================================
// 7. Multi-File Batch Review & Diff Modal
// ==========================================

function renderDiffTable(diffLines) {
    let rowsHtml = '';
    diffLines.forEach(item => {
        const cls = item.type === 'added' ? 'ai-diff-row-added' : item.type === 'removed' ? 'ai-diff-row-removed' : 'ai-diff-row-unchanged';
        const sign = item.type === 'added' ? '+' : item.type === 'removed' ? '-' : ' ';
        const lineNum = item.newLine || item.oldLine || '';
        rowsHtml += `
            <tr class="ai-diff-row ${cls}">
                <td class="ai-diff-num">${lineNum}</td>
                <td class="ai-diff-sign">${sign}</td>
                <td>${escapeHtml(item.text)}</td>
            </tr>
        `;
    });
    return `<table class="ai-diff-table">${rowsHtml}</table>`;
}

function showBatchReviewModal(processedFiles) {
    return new Promise((resolve) => {
        const existing = document.querySelector('.ai-sync-modal-backdrop');
        if (existing) existing.remove();

        const backdrop = document.createElement('div');
        backdrop.className = 'ai-sync-modal-backdrop';

        let activeIndex = 0;
        let currentView = 'diff';

        const fileStates = processedFiles.map(f => ({
            ...f,
            selected: !f.hasDiffError && !f.isExcerpt && !f.isIdentical,
            editedContent: f.targetContent
        }));

        function cleanupAndClose(result = []) {
            document.removeEventListener('keydown', handleKeyDown);
            backdrop.remove();
            resolve(result);
        }

        function handleKeyDown(e) {
            if (e.key === 'Escape') {
                e.preventDefault();
                cleanupAndClose([]);
            }
        }

        document.addEventListener('keydown', handleKeyDown);

        function render() {
            const currentFile = fileStates[activeIndex];
            const diffLines = computeLineDiff(currentFile.originalContent || '', currentFile.editedContent);

            const sidebarItemsHtml = fileStates.map((file, idx) => `
                <div class="ai-sync-file-list-item ${idx === activeIndex ? 'active' : ''}" data-idx="${idx}">
                    <div style="display: flex; align-items: center; gap: 8px; overflow: hidden;">
                        <input type="checkbox" class="file-chk" data-idx="${idx}" ${file.selected ? 'checked' : ''} ${file.hasDiffError ? 'disabled' : ''} />
                        <span style="white-space: nowrap; text-overflow: ellipsis; overflow: hidden;" title="${escapeHtml(file.filePath)}">${escapeHtml(file.filePath)}</span>
                    </div>
                    <span class="ai-file-status-badge ${getStatusBadgeClass(file)}">${getStatusBadgeText(file)}</span>
                </div>
            `).join('');

            backdrop.innerHTML = `
                <div class="ai-sync-modal-dialog">
                    <div class="ai-sync-modal-header">
                        <div class="ai-sync-modal-title">
                            <span>📦 ${t('filesToSync')}</span>
                            <span style="font-size: 12px; color: #94a3b8;">(${fileStates.filter(f => f.selected).length}/${fileStates.length} ${t('selected')} - <kbd style="background:#334155;padding:2px 5px;border-radius:4px;">Esc</kbd> ${t('cancel').toLowerCase()})</span>
                        </div>
                        <button id="btn-modal-close" class="ai-sync-btn ai-sync-btn-secondary" style="padding: 4px 8px;">✕</button>
                    </div>
                    <div class="ai-sync-modal-layout">
                        <div class="ai-sync-modal-sidebar">
                            <div class="ai-sync-sidebar-header">${t('filesToSync')}</div>
                            ${sidebarItemsHtml}
                        </div>

                        <div class="ai-sync-modal-main">
                            <div class="ai-sync-main-toolbar">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <strong style="color: #38bdf8; font-size: 13px;">${escapeHtml(currentFile.filePath)}</strong>
                                    ${currentFile.isDiff ? `<span class="ai-file-status-badge badge-diff">${t('diffMerged')}</span>` : ''}
                                    ${currentFile.isExcerpt ? `<span class="ai-file-status-badge badge-warn">${t('excerpt')}</span>` : ''}
                                    ${currentFile.isIdentical ? `<span class="ai-file-status-badge badge-same">${t('noChanges')}</span>` : ''}
                                </div>
                                <div class="ai-sync-view-tabs">
                                    <button class="ai-sync-tab-btn ${currentView === 'diff' ? 'active' : ''}" id="tab-diff">🔍 ${t('visualDiff')}</button>
                                    <button class="ai-sync-tab-btn ${currentView === 'editor' ? 'active' : ''}" id="tab-editor">✏️ ${t('editCode')}</button>
                                </div>
                            </div>
                            <div class="ai-sync-main-body">
                                ${currentFile.isExcerpt ? `
                                    <div class="ai-sync-alert-box ai-sync-alert-warning">
                                        <strong>${t('excerptDetected')}</strong> ${t('excerptHelp')}
                                    </div>
                                ` : ''}
                                ${currentFile.hasDiffError ? `
                                    <div class="ai-sync-alert-box ai-sync-alert-danger">
                                        <strong>${t('diffError')}</strong> ${escapeHtml(currentFile.diffErrorMsg)}<br>
                                        ${t('diffErrorHelp')}
                                    </div>
                                ` : ''}
                                ${currentFile.validation.issues.length > 0 ? `
                                    <div class="ai-sync-alert-box ai-sync-alert-danger">
                                        <strong>${t('syntaxIssues')}</strong><br>${currentFile.validation.issues.map(i => `• ${escapeHtml(i)}`).join('<br>')}
                                    </div>
                                ` : ''}
                                ${currentFile.validation.warnings.length > 0 ? `
                                    <div class="ai-sync-alert-box ai-sync-alert-warning">
                                        <strong>${t('placeholders')}</strong><br>${currentFile.validation.warnings.map(w => `• ${escapeHtml(w)}`).join('<br>')}
                                    </div>
                                ` : ''}

                                ${currentView === 'diff' ? `
                                    <div class="ai-diff-container">${renderDiffTable(diffLines)}</div>
                                ` : `
                                    <textarea class="ai-sync-editor-textarea" id="main-editor" spellcheck="false">${escapeHtml(currentFile.editedContent)}</textarea>
                                `}
                            </div>
                        </div>
                    </div>
                    <div class="ai-sync-modal-footer">
                        <button class="ai-sync-btn ai-sync-btn-secondary" id="btn-skip-all">${t('skipAll')} (Esc)</button>
                        <div class="ai-sync-btn-group">
                            ${currentFile.isExcerpt ? `
                                <button class="ai-sync-btn ai-sync-btn-warning" id="btn-request-full">🛡️ ${t('requestFull')}</button>
                            ` : ''}
                            <button class="ai-sync-btn ai-sync-btn-primary" id="btn-sync-selected">
                                💾 ${t('syncSelected', { count: fileStates.filter(f => f.selected).length })}
                            </button>
                        </div>
                    </div>
                </div>
            `;

            attachEvents();
        }

        function getStatusBadgeClass(file) {
            if (file.isExcerpt) return 'badge-warn';
            if (file.hasDiffError) return 'badge-err';
            if (file.validation.issues.length > 0) return 'badge-err';
            if (file.validation.warnings.length > 0) return 'badge-warn';
            if (file.isIdentical) return 'badge-same';
            if (file.isDiff) return 'badge-diff';
            return file.originalContent === null ? 'badge-new' : 'badge-mod';
        }

        function getStatusBadgeText(file) {
            if (file.isExcerpt) return t('excerpt');
            if (file.hasDiffError) return t('statusDiffError');
            if (file.validation.issues.length > 0) return t('statusSyntax');
            if (file.validation.warnings.length > 0) return t('statusWarn');
            if (file.isIdentical) return t('statusSame');
            if (file.isDiff) return t('statusDiff');
            return file.originalContent === null ? t('statusNew') : t('statusMod');
        }

        function attachEvents() {
            backdrop.onclick = (e) => {
                if (e.target === backdrop) cleanupAndClose([]);
            };

            backdrop.querySelector('#btn-modal-close').onclick = () => cleanupAndClose([]);
            backdrop.querySelector('#btn-skip-all').onclick = () => cleanupAndClose([]);

            backdrop.querySelectorAll('.ai-sync-file-list-item').forEach(item => {
                item.onclick = (e) => {
                    if (e.target.tagName === 'INPUT') return;
                    activeIndex = parseInt(item.dataset.idx, 10);
                    render();
                };
            });

            backdrop.querySelectorAll('.file-chk').forEach(chk => {
                chk.onchange = (e) => {
                    e.stopPropagation();
                    const idx = parseInt(chk.dataset.idx, 10);
                    fileStates[idx].selected = chk.checked;
                    render();
                };
            });

            const tabDiff = backdrop.querySelector('#tab-diff');
            const tabEditor = backdrop.querySelector('#tab-editor');
            if (tabDiff && tabEditor) {
                tabDiff.onclick = () => { currentView = 'diff'; render(); };
                tabEditor.onclick = () => { currentView = 'editor'; render(); };
            }

            const editor = backdrop.querySelector('#main-editor');
            if (editor) {
                editor.addEventListener('keydown', (e) => {
                    if (e.key === 'Tab') {
                        e.preventDefault();
                        const start = editor.selectionStart;
                        const end = editor.selectionEnd;
                        editor.value = editor.value.substring(0, start) + '    ' + editor.value.substring(end);
                        editor.selectionStart = editor.selectionEnd = start + 4;
                    }
                });
                editor.addEventListener('input', () => {
                    fileStates[activeIndex].editedContent = editor.value;
                    if (fileStates[activeIndex].hasDiffError) {
                        fileStates[activeIndex].hasDiffError = false;
                        fileStates[activeIndex].diffErrorMsg = '';
                        fileStates[activeIndex].isDiff = false;
                        fileStates[activeIndex].selected = true;
                    }
                    fileStates[activeIndex].validation = validateContent(fileStates[activeIndex].filePath, editor.value);
                    fileStates[activeIndex].isIdentical = (fileStates[activeIndex].originalContent || '').replace(/\r\n/g, '\n') === editor.value.replace(/\r\n/g, '\n');
                });
            }

            const requestFullBtn = backdrop.querySelector('#btn-request-full');
            if (requestFullBtn) {
                requestFullBtn.onclick = async () => {
                    const file = fileStates[activeIndex];
                    await insertIntoPrompt(`The response for "${file.filePath}" was marked as an excerpt. Please provide either the complete file or a precise SEARCH/REPLACE patch.\n\n${STRICT_SYNC_FORMAT_PROMPT}`);
                    showToast(t('requestedFull', { path: file.filePath }), 'success');
                };
            }

            backdrop.querySelector('#btn-sync-selected').onclick = () => {
                const toWrite = fileStates
                    .filter(f => f.selected)
                    .map(f => ({ filePath: f.filePath, content: f.editedContent }));
                cleanupAndClose(toWrite);
            };
        }

        document.body.appendChild(backdrop);
        render();
    });
}

// ==========================================
// 8. Recursive Gitignore & Depth-Agnostic File Collector
// ==========================================

const ALWAYS_IGNORE_DIR_NAMES = new Set([
    '.git', '.svn', '.hg', '.DS_Store', 'Thumbs.db',
    'node_modules', '.venv', 'venv', 'env', '__pycache__',
    '.idea', '.vscode', '.turbo', '.output'
]);

const UNIVERSAL_DEFAULT_PATTERNS = [
    'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lockb', 'Cargo.lock', 'composer.lock', 'poetry.lock', 'Gemfile.lock', 'symfony.lock',
    'dist/**', 'build/**', 'out/**', '.next/**', '.nuxt/**', 'coverage/**', '.nyc_output/**', '.cache/**', '*.pyc', '*.pyo', '*.swp',
    '*.png', '*.jpg', '*.jpeg', '*.gif', '*.ico', '*.webp', '*.svg', '*.mp4', '*.webm', '*.mp3', '*.wav',
    '*.pdf', '*.zip', '*.tar', '*.gz', '*.7z', '*.rar', '*.exe', '*.dll', '*.so', '*.dylib', '*.wasm', '*.bin',
    '*.ttf', '*.woff', '*.woff2', '*.eot',
    '.env', '.env.*', '*.pem', '*.key', 'id_rsa'
];

class ScopedGitignoreRule {
    constructor(pattern, basePath = '') {
        this.raw = pattern.trim();
        this.basePath = basePath.replace(/^[\\\/]+/, '').replace(/[\\\/]+$/, '');
        this.isNegated = this.raw.startsWith('!');
        let p = this.isNegated ? this.raw.slice(1).trim() : this.raw;

        this.isDirOnly = p.endsWith('/');
        if (this.isDirOnly) p = p.slice(0, -1);

        this.isRooted = p.startsWith('/');
        if (this.isRooted) p = p.slice(1);

        this.hasSlash = p.includes('/');

        let re = p
            .replace(/\./g, '\\.')
            .replace(/\*\*/g, '§§')
            .replace(/\*/g, '[^/]*')
            .replace(/§§/g, '.*')
            .replace(/\?/g, '[^/]');

        if (this.basePath) {
            const escBase = this.basePath.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            if (this.hasSlash || this.isRooted) {
                this.regex = new RegExp(`^${escBase}/${re}(?:$|/.*$)`, 'i');
            } else {
                this.regex = new RegExp(`^${escBase}/(?:.*/)?${re}(?:$|/.*$)`, 'i');
            }
        } else {
            if (this.hasSlash || this.isRooted) {
                this.regex = new RegExp(`^${re}(?:$|/.*$)`, 'i');
            } else {
                this.regex = new RegExp(`(?:^|/)${re}(?:$|/.*$)`, 'i');
            }
        }
    }

    matches(relPath, isDirectory) {
        if (this.isDirOnly && !isDirectory) return false;
        return this.regex.test(relPath);
    }
}

function parseGitignoreContent(content, basePath = '') {
    const rules = [];
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
            rules.push(new ScopedGitignoreRule(trimmed, basePath));
        }
    }
    return rules;
}

function isPathIgnoredWithRules(relPath, isDirectory, rules) {
    let ignored = false;
    for (const rule of rules) {
        if (rule.matches(relPath, isDirectory)) {
            ignored = !rule.isNegated;
        }
    }
    return ignored;
}

async function collectAllRepositoryFiles(dirHandle, parentRules = null, currentPath = '') {
    const fileList = [];

    let activeRules = parentRules ? [...parentRules] : UNIVERSAL_DEFAULT_PATTERNS.map(p => new ScopedGitignoreRule(p, ''));

    try {
        const gitignoreHandle = await dirHandle.getFileHandle('.gitignore', { create: false });
        const gitignoreFile = await gitignoreHandle.getFile();
        const gitignoreText = await gitignoreFile.text();
        const localRules = parseGitignoreContent(gitignoreText, currentPath);
        activeRules.push(...localRules);
    } catch {
        // No .gitignore
    }

    for await (const entry of dirHandle.values()) {
        const entryName = entry.name;
        const entryRelPath = currentPath ? `${currentPath}/${entryName}` : entryName;
        const isDir = entry.kind === 'directory';

        if (isDir && ALWAYS_IGNORE_DIR_NAMES.has(entryName)) {
            continue;
        }
        if (!isDir && (entryName === '.DS_Store' || entryName === 'Thumbs.db')) {
            continue;
        }

        if (isPathIgnoredWithRules(entryRelPath, isDir, activeRules)) {
            continue;
        }

        if (isDir) {
            const subDirHandle = await dirHandle.getDirectoryHandle(entryName);
            const subFiles = await collectAllRepositoryFiles(subDirHandle, activeRules, entryRelPath);
            fileList.push(...subFiles);
        } else if (entry.kind === 'file') {
            try {
                const file = await entry.getFile();
                if (file.size > 800 * 1024) continue;

                const text = await file.text();
                if (text.includes('\0')) continue;

                const tokens = Math.round(text.length / 4);
                fileList.push({
                    filePath: entryRelPath,
                    size: file.size,
                    charCount: text.length,
                    tokens: tokens,
                    content: text,
                    selected: true
                });
            } catch {
                // Ignore locked/unreadable
            }
        }
    }

    return fileList;
}

function buildTokenHierarchyTree(files) {
    const root = {
        name: 'root',
        path: '',
        isDir: true,
        children: new Map(),
        fileRef: null,
        totalTokens: 0,
        totalBytes: 0,
        totalFiles: 0,
        selectedTokens: 0,
        selectedBytes: 0,
        selectedFiles: 0,
        selected: true,
        indeterminate: false
    };

    for (const file of files) {
        const parts = file.filePath.split('/');
        let cur = root;
        let curPath = '';

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            curPath = curPath ? `${curPath}/${part}` : part;
            const isFile = i === parts.length - 1;

            if (!cur.children.has(part)) {
                cur.children.set(part, {
                    name: part,
                    path: curPath,
                    isDir: !isFile,
                    children: new Map(),
                    fileRef: isFile ? file : null,
                    totalTokens: 0,
                    totalBytes: 0,
                    totalFiles: 0,
                    selectedTokens: 0,
                    selectedBytes: 0,
                    selectedFiles: 0,
                    selected: file.selected,
                    indeterminate: false
                });
            }
            cur = cur.children.get(part);
        }
    }

    function aggregateAndSort(node) {
        if (!node.isDir && node.fileRef) {
            node.totalTokens = node.fileRef.tokens;
            node.totalBytes = node.fileRef.size;
            node.totalFiles = 1;
            node.selectedTokens = node.fileRef.selected ? node.totalTokens : 0;
            node.selectedBytes = node.fileRef.selected ? node.totalBytes : 0;
            node.selectedFiles = node.fileRef.selected ? 1 : 0;
            node.selected = node.fileRef.selected;
            node.indeterminate = false;
            return;
        }

        let sumTokens = 0, sumBytes = 0, sumFiles = 0;
        let selTokens = 0, selBytes = 0, selFiles = 0;

        const childArr = Array.from(node.children.values());
        for (const child of childArr) {
            aggregateAndSort(child);
            sumTokens += child.totalTokens;
            sumBytes += child.totalBytes;
            sumFiles += child.totalFiles;
            selTokens += child.selectedTokens;
            selBytes += child.selectedBytes;
            selFiles += child.selectedFiles;
        }

        node.totalTokens = sumTokens;
        node.totalBytes = sumBytes;
        node.totalFiles = sumFiles;
        node.selectedTokens = selTokens;
        node.selectedBytes = selBytes;
        node.selectedFiles = selFiles;

        const allSelected = childArr.every(c => c.selected && !c.indeterminate);
        const noneSelected = childArr.every(c => !c.selected && !c.indeterminate);

        if (allSelected) {
            node.selected = true;
            node.indeterminate = false;
        } else if (noneSelected) {
            node.selected = false;
            node.indeterminate = false;
        } else {
            node.selected = false;
            node.indeterminate = true;
        }

        childArr.sort((a, b) => {
            if (b.totalTokens !== a.totalTokens) return b.totalTokens - a.totalTokens;
            if (b.totalBytes !== a.totalBytes) return b.totalBytes - a.totalBytes;
            return a.name.localeCompare(b.name);
        });

        node.sortedChildren = childArr;
    }

    aggregateAndSort(root);
    return root;
}

function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatTokens(tokens) {
    if (tokens < 1000) return `${tokens} t`;
    if (tokens < 1000000) return `${(tokens / 1000).toFixed(1)}k t`;
    return `${(tokens / 1000000).toFixed(2)}M t`;
}

function formatCodebaseContext(files, rootName = 'workspace') {
    const activeFiles = files.filter(f => f.selected);

    const paths = activeFiles.map(f => f.filePath).sort();
    const treeStructure = buildTreeFromPaths(paths);

    let xml = `This file is a merged representation of the entire codebase, packed into a single document for AI context.\n\n`;
    xml += `<file_summary>\nThis section contains a summary of this file.\n\n`;
    xml += `<purpose>\nThis file contains a packed representation of the entire repository's contents.\nIt is designed to be easily consumable by AI systems for analysis, code review,\nor other automated processes.\n</purpose>\n\n`;
    xml += `<file_format>\nThe content is organized as follows:\n1. This summary section\n2. Repository information\n3. Directory structure\n4. Repository files\n5. Multiple file entries, each consisting of:\n  - File path as an attribute\n  - Full contents of the file\n</file_format>\n\n`;
    xml += `<notes>\n- Total files packed: ${activeFiles.length}\n- Project root: ${rootName}\n- Files matching .gitignore and default ignore patterns were excluded\n</notes>\n</file_summary>\n\n`;

    xml += `<sync_instructions>\nWhen modifying or creating files, return one canonical git unified diff inside a single SIX-backtick Markdown fence (open with six backticks followed by diff; close with six backticks). The long outer fence prevents backticks inside Markdown files from breaking the diff block. Put repository-relative paths in the diff --git, ---, and +++ headers. Use /dev/null as the old path for new files. Include enough exact unchanged context for every hunk to match. Do not put prose, excerpts, placeholders, or full unchanged files inside the diff fence.\n</sync_instructions>\n\n`;

    xml += `<directory_structure>\n${treeStructure}</directory_structure>\n\n`;

    xml += `<files>\nThis section contains the contents of the repository's files.\n\n`;
    for (const file of activeFiles) {
        xml += `<file path="${file.filePath}">\n${file.content}\n</file>\n\n`;
    }
    xml += `</files>\n`;

    return xml;
}

function buildTreeFromPaths(paths) {
    const root = {};
    for (const path of paths) {
        const parts = path.split('/');
        let cur = root;
        for (const part of parts) {
            if (!cur[part]) cur[part] = {};
            cur = cur[part];
        }
    }

    function renderNode(node, prefix = '') {
        const keys = Object.keys(node).sort((a, b) => {
            const aIsDir = Object.keys(node[a]).length > 0;
            const bIsDir = Object.keys(node[b]).length > 0;
            if (aIsDir === bIsDir) return a.localeCompare(b);
            return aIsDir ? -1 : 1;
        });

        let str = '';
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            const isLast = i === keys.length - 1;
            const isDir = Object.keys(node[key]).length > 0;
            const branch = isLast ? '└── ' : '├── ';
            const nextPrefix = prefix + (isLast ? '    ' : '│   ');
            str += `${prefix}${branch}${key}${isDir ? '/' : ''}\n`;
            if (isDir) {
                str += renderNode(node[key], nextPrefix);
            }
        }
        return str;
    }

    return renderNode(root);
}

function showContextPackerModal(files, rootName) {
    return new Promise((resolve) => {
        const existing = document.querySelector('.ai-sync-modal-backdrop');
        if (existing) existing.remove();

        const backdrop = document.createElement('div');
        backdrop.className = 'ai-sync-modal-backdrop';

        let fileListState = [...files];
        let filterText = '';
        const expandedDirs = new Set(['']);

        fileListState.forEach(f => {
            const parts = f.filePath.split('/');
            if (parts.length > 1) expandedDirs.add(parts[0]);
        });

        function cleanupAndClose(result = null) {
            document.removeEventListener('keydown', handleKeyDown);
            backdrop.remove();
            resolve(result);
        }

        function handleKeyDown(e) {
            if (e.key === 'Escape') {
                e.preventDefault();
                cleanupAndClose(null);
            }
        }

        document.addEventListener('keydown', handleKeyDown);

        function toggleFolderSelection(node, isSelected) {
            if (!node.isDir && node.fileRef) {
                node.fileRef.selected = isSelected;
            } else if (node.sortedChildren) {
                for (const child of node.sortedChildren) {
                    toggleFolderSelection(child, isSelected);
                }
            }
        }

        function renderTreeRowsHtml(node, level, maxRootTokens) {
            if (!node.sortedChildren) return '';
            let html = '';

            for (const child of node.sortedChildren) {
                if (filterText && !child.path.toLowerCase().includes(filterText.toLowerCase())) {
                    const hasMatchingDescendant = fileListState.some(
                        f => f.filePath.startsWith(child.path) && f.filePath.toLowerCase().includes(filterText.toLowerCase())
                    );
                    if (!hasMatchingDescendant) continue;
                }

                const isExpanded = expandedDirs.has(child.path);
                const indentPadding = level * 18;
                const tokenPercent = maxRootTokens > 0 ? (child.totalTokens / maxRootTokens) * 100 : 0;
                const isHighPercent = tokenPercent > 20;

                const icon = child.isDir ? (isExpanded ? '📂' : '📁') : '📄';
                const expanderHtml = child.isDir
                    ? `<span class="packer-expander" data-toggle-expand="${escapeHtml(child.path)}">${isExpanded ? '▼' : '▶'}</span>`
                    : `<span class="packer-expander-spacer"></span>`;

                html += `
                    <div class="packer-tree-row ${child.isDir ? 'packer-tree-row-dir' : 'packer-tree-row-file'}" style="padding-left: ${16 + indentPadding}px;">
                        <div class="packer-col-name">
                            ${expanderHtml}
                            <input type="checkbox" class="packer-tree-chk" data-path="${escapeHtml(child.path)}" data-isdir="${child.isDir}"
                                ${child.selected ? 'checked' : ''} ${child.indeterminate ? 'data-indeterminate="true"' : ''} />
                            <span style="font-size: 13px;">${icon}</span>
                            <span class="packer-row-name-text" title="${escapeHtml(child.path)}">${escapeHtml(child.name)}${child.isDir ? '/' : ''}</span>
                        </div>
                        <div class="packer-col-tokens">
                            <div class="packer-token-meter-cell">
                                <div class="packer-mini-bar" title="${tokenPercent.toFixed(1)}% of codebase">
                                    <div class="packer-mini-bar-fill ${isHighPercent ? 'packer-mini-bar-fill-high' : ''}" style="width: ${Math.max(3, tokenPercent)}%;"></div>
                                </div>
                                <span class="packer-token-count">~${formatTokens(child.totalTokens)}</span>
                            </div>
                        </div>
                        <div class="packer-col-size">
                            <span class="packer-size-count">${formatBytes(child.totalBytes)}</span>
                        </div>
                    </div>
                `;

                if (child.isDir && isExpanded) {
                    html += renderTreeRowsHtml(child, level + 1, maxRootTokens);
                }
            }

            return html;
        }

        function render() {
            const treeRoot = buildTokenHierarchyTree(fileListState);
            const totalCodebaseTokens = treeRoot.totalTokens;
            const selectedFiles = fileListState.filter(f => f.selected);
            const totalChars = selectedFiles.reduce((acc, f) => acc + f.charCount, 0);
            const totalBytes = selectedFiles.reduce((acc, f) => acc + f.size, 0);
            const selectedTokens = Math.round(totalChars / 4);
            const percentageOfTotal = totalCodebaseTokens > 0 ? ((selectedTokens / totalCodebaseTokens) * 100).toFixed(1) : 100;

            const treeRowsHtml = renderTreeRowsHtml(treeRoot, 0, totalCodebaseTokens);

            backdrop.innerHTML = `
                <div class="ai-sync-modal-dialog context-packer-dialog">
                    <div class="ai-sync-modal-header">
                        <div class="ai-sync-modal-title">
                        <span>📊 ${t('packContext')}</span>
                            <div class="context-packer-stats-bar">
                                <span class="context-packer-stat-badge">📄 ${selectedFiles.length}/${fileListState.length} files</span>
                                <span class="context-packer-stat-badge">💾 ${formatBytes(totalBytes)}</span>
                                <span class="context-packer-stat-badge" style="color: #4ade80;">⚡ ~${selectedTokens.toLocaleString()} tokens (${percentageOfTotal}%)</span>
                            </div>
                        </div>
                        <button id="btn-packer-close" class="ai-sync-btn ai-sync-btn-secondary" style="padding: 4px 8px;">✕</button>
                    </div>

                    <div class="context-packer-filter-container">
                        <input type="text" class="context-packer-input" id="packer-search" placeholder="🔍 ${t('searchFiles')}" value="${escapeHtml(filterText)}" />
                        <input type="text" class="context-packer-input" id="packer-custom-ignore" placeholder="${t('excludeGlobs')}" />
                        <button class="ai-sync-btn ai-sync-btn-secondary" id="btn-apply-exclude" style="font-size: 11px;">${t('applyGlobs')}</button>
                        <button class="ai-sync-btn ai-sync-btn-secondary" id="btn-expand-all" style="font-size: 11px;">${t('expandAll')}</button>
                        <button class="ai-sync-btn ai-sync-btn-secondary" id="btn-collapse-all" style="font-size: 11px;">${t('collapseAll')}</button>
                        <button class="ai-sync-btn ai-sync-btn-secondary" id="btn-toggle-all" style="font-size: 11px;">
                            ${selectedFiles.length === fileListState.length ? t('deselectAll') : t('selectAll')}
                        </button>
                    </div>

                    <div class="packer-tree-wrapper">
                        <div class="packer-tree-header">
                            <div class="packer-col-name">${t('folderStructure')}</div>
                            <div class="packer-col-tokens">${t('tokensUsage')}</div>
                            <div class="packer-col-size">${t('size')}</div>
                        </div>
                        <div class="packer-tree-body">
                            ${treeRowsHtml || `<div style="padding: 24px; text-align: center; color: #64748b;">${t('noMatchingFiles')}</div>`}
                        </div>
                    </div>

                    <div class="ai-sync-modal-footer">
                        <button class="ai-sync-btn ai-sync-btn-secondary" id="btn-packer-cancel">${t('cancel')} (Esc)</button>
                        <div class="ai-sync-btn-group">
                            <button class="ai-sync-btn ai-sync-btn-secondary" id="btn-packer-copy">${t('copyContext')}</button>
                            <button class="ai-sync-btn ai-sync-btn-primary" id="btn-packer-insert">
                                ${t('insertContext', { tokens: formatTokens(selectedTokens) })}
                            </button>
                        </div>
                    </div>
                </div>
            `;

            backdrop.querySelectorAll('.packer-tree-chk[data-indeterminate="true"]').forEach(chk => {
                chk.indeterminate = true;
            });

            attachEvents(treeRoot);
        }

        function findNodeByPath(root, targetPath) {
            if (root.path === targetPath) return root;
            if (root.sortedChildren) {
                for (const child of root.sortedChildren) {
                    const found = findNodeByPath(child, targetPath);
                    if (found) return found;
                }
            }
            return null;
        }

        function attachEvents(treeRoot) {
            backdrop.onclick = (e) => {
                if (e.target === backdrop) cleanupAndClose(null);
            };

            backdrop.querySelector('#btn-packer-close').onclick = () => cleanupAndClose(null);
            backdrop.querySelector('#btn-packer-cancel').onclick = () => cleanupAndClose(null);

            const searchInput = backdrop.querySelector('#packer-search');
            searchInput.oninput = (e) => {
                filterText = e.target.value;
                render();
                const newSearch = backdrop.querySelector('#packer-search');
                newSearch.focus();
                newSearch.setSelectionRange(newSearch.value.length, newSearch.value.length);
            };

            backdrop.querySelectorAll('[data-toggle-expand]').forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    const path = btn.dataset.toggleExpand;
                    if (expandedDirs.has(path)) {
                        expandedDirs.delete(path);
                    } else {
                        expandedDirs.add(path);
                    }
                    render();
                };
            });

            backdrop.querySelectorAll('.packer-tree-chk').forEach(chk => {
                chk.onchange = (e) => {
                    e.stopPropagation();
                    const path = chk.dataset.path;
                    const node = findNodeByPath(treeRoot, path);
                    if (node) {
                        toggleFolderSelection(node, chk.checked);
                        render();
                    }
                };
            });

            backdrop.querySelector('#btn-expand-all').onclick = () => {
                fileListState.forEach(f => {
                    const parts = f.filePath.split('/');
                    let cur = '';
                    for (let i = 0; i < parts.length - 1; i++) {
                        cur = cur ? `${cur}/${parts[i]}` : parts[i];
                        expandedDirs.add(cur);
                    }
                });
                render();
            };

            backdrop.querySelector('#btn-collapse-all').onclick = () => {
                expandedDirs.clear();
                expandedDirs.add('');
                render();
            };

            backdrop.querySelector('#btn-toggle-all').onclick = () => {
                const allSelected = fileListState.every(f => f.selected);
                fileListState.forEach(f => f.selected = !allSelected);
                render();
            };

            backdrop.querySelector('#btn-apply-exclude').onclick = () => {
                const patternInput = backdrop.querySelector('#packer-custom-ignore').value.trim();
                if (!patternInput) return;
                const patterns = patternInput.split(',').map(p => p.trim()).filter(Boolean);
                const rules = patterns.map(p => new ScopedGitignoreRule(p, ''));

                let excludedCount = 0;
                fileListState.forEach(f => {
                    if (isPathIgnoredWithRules(f.filePath, false, rules)) {
                        f.selected = false;
                        excludedCount++;
                    }
                });
                showToast(t('excluded', { count: excludedCount }), 'info', 2000);
                render();
            };

            backdrop.querySelector('#btn-packer-copy').onclick = async () => {
                const contextXml = formatCodebaseContext(fileListState, rootName);
                await navigator.clipboard.writeText(contextXml);
                showToast(t('copied'), 'success');
                cleanupAndClose(null);
            };

            backdrop.querySelector('#btn-packer-insert').onclick = async () => {
                const contextXml = formatCodebaseContext(fileListState, rootName);
                await insertIntoPrompt(contextXml);
                showToast(t('packed', { count: fileListState.filter(f => f.selected).length }), 'success');
                cleanupAndClose(null);
            };
        }

        document.body.appendChild(backdrop);
        render();
    });
}

// ==========================================
// 9. Prompt Context Insertion (Native Paste Interception & Artifact Trigger)
// ==========================================

async function insertIntoPrompt(text) {
    const inputEl = document.querySelector(AI_STUDIO_SELECTORS.promptInput);

    try {
        await navigator.clipboard.writeText(text);
    } catch {
        // Fallback
    }

    if (inputEl) {
        inputEl.focus();

        const dataTransfer = new DataTransfer();
        dataTransfer.setData('text/plain', text);
        dataTransfer.setData('text/html', `<pre>${escapeHtml(text)}</pre>`);

        const pasteEvent = new ClipboardEvent('paste', {
            bubbles: true,
            cancelable: true,
            composed: true,
            clipboardData: dataTransfer
        });

        const isHandledByAIStudio = !inputEl.dispatchEvent(pasteEvent);

        if (!isHandledByAIStudio) {
            let inserted = false;
            try {
                inserted = document.execCommand('insertText', false, text);
            } catch {
                inserted = false;
            }

            if (!inserted) {
                const currentVal = inputEl.value;
                const separator = currentVal.trim().length > 0 ? '\n\n' : '';
                inputEl.value = currentVal + separator + text;
                inputEl.dispatchEvent(new Event('input', { bubbles: true }));
                inputEl.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
        inputEl.scrollTop = inputEl.scrollHeight;
    } else {
        const editableEl = document.querySelector(AI_STUDIO_SELECTORS.editablePrompt);
        if (editableEl) {
            editableEl.focus();
            const dataTransfer = new DataTransfer();
            dataTransfer.setData('text/plain', text);
            const pasteEvent = new ClipboardEvent('paste', {
                bubbles: true,
                cancelable: true,
                composed: true,
                clipboardData: dataTransfer
            });
            const handled = !editableEl.dispatchEvent(pasteEvent);
            if (!handled) {
                const current = editableEl.innerText.trim();
                editableEl.innerText = (current ? current + '\n\n' : '') + text;
                editableEl.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }
    }
}

function handleSkippedFilesResolution(skippedFiles) {
    if (!skippedFiles || skippedFiles.length === 0) return;
    const fileListText = skippedFiles.map(f => `- \`${f.filePath}\`${f.reason ? ` (${f.reason})` : ''}`).join('\n');
    const promptMessage = `The following file(s) were skipped or could not be fully synced to disk:\n${fileListText}\n\nPlease provide the full, completed, ready-to-save code for these file(s) without placeholders.`;
    insertIntoPrompt(promptMessage);
}

// ==========================================
// 10. Robust Path Extraction (Markdown & Large-Text Dual Engine)
// ==========================================

function isValidFileCandidate(candidate) {
    if (!candidate || candidate.length > 220) return false;
    const clean = cleanCandidatePath(candidate);
    if (/^(?:https?:\/\/|www\.|git@|mailto:)/i.test(clean)) return false;
    if (/(?:github\.com|gitlab\.com|shields\.io|google\.com|localhost|mozilla\.org)/i.test(clean)) return false;

    // Special known no-extension files or dotfiles
    const knownSpecial = new Set(['license', 'makefile', 'dockerfile', 'procfile', '.gitignore', '.env', '.dockerignore', '.editorconfig', '.npmignore', '.prettierrc', '.eslintrc']);
    if (knownSpecial.has(clean.toLowerCase()) || knownSpecial.has(clean.split('/').pop().toLowerCase())) {
        return true;
    }

    const extMatch = clean.match(/\.([a-zA-Z0-9_-]+)$/);
    if (!extMatch) return false;
    const ext = extMatch[1].toLowerCase();

    const invalidExts = new Set(['com', 'org', 'net', 'io', 'dev', 'app', 'ai', 'co', 'uk', 'html#', 'md#', 'pl']);
    if (invalidExts.has(ext) && !clean.includes('/')) return false;

    return true;
}

function cleanCandidatePath(raw) {
    if (!raw) return null;
    let clean = String(raw).trim();
    clean = clean.replace(/^(?:#{1,6}\s*)?(?:\d+[\.\)]|\*|-|\+)\s+/, '');
    clean = clean.replace(/[`"'*]/g, '').trim();
    clean = clean.replace(/\s*\([^)]*\)\s*$/i, '').trim();
    clean = clean.replace(/\s*[-—:]\s*(?:excerpt|snippet|diff|patch|part|update).*$/i, '').trim();
    return clean;
}

function isExcerptMarker(text) {
    return /\b(?:excerpt|snippet|partial)\b/i.test(text || '');
}

function extractExplicitFilePathFromText(text) {
    const value = String(text || '').trim();
    const pathPattern = '([a-zA-Z0-9_.\\/-]+(?:\\.[a-zA-Z0-9_-]+|\\/(?:LICENSE|Makefile|Dockerfile|Procfile)))';
    const patterns = [
        new RegExp(`\\b(?:file|path|filename)(?:\\s+content)?\\s*(?:for|:)\\s*[\\u0060"]?${pathPattern}[\\u0060"]?`, 'i'),
        new RegExp(`\\b(?:complete|full|ready-to-save)\\b[^\\n]{0,100}\\b(?:file|content)\\b[^\\n]{0,50}\\bfor\\s+[\\u0060"]?${pathPattern}[\\u0060"]?`, 'i')
    ];

    for (const pattern of patterns) {
        const match = value.match(pattern);
        if (match && isValidFileCandidate(match[1])) return cleanCandidatePath(match[1]);
    }
    return null;
}

function stripOuterMarkdownFence(text) {
    const normalized = String(text || '').replace(/\r\n/g, '\n');
    const match = normalized.match(/^(`{3,}|~{3,})[^\n]*\n([\s\S]*?)\n\1[\t ]*\n?$/);
    return match ? match[2] : normalized;
}

function normalizeDiffPath(rawPath) {
    if (!rawPath) return null;
    let path = String(rawPath).trim().split(/\s+/)[0];
    path = path.replace(/^"|"$/g, '');
    if (path === '/dev/null') return null;
    return cleanCandidatePath(path.replace(/^[ab]\//, ''));
}

function extractUnifiedDiffFiles(text) {
    const source = String(text || '').replace(/\r\n/g, '\n');
    const lines = source.split('\n');
    const starts = [];

    for (let i = 0; i < lines.length; i++) {
        if (/^diff --git\s+/.test(lines[i])) starts.push(i);
    }

    // Some models omit `diff --git` but retain canonical ---/+++ file headers.
    if (starts.length === 0) {
        for (let i = 0; i < lines.length - 1; i++) {
            if (/^---\s+/.test(lines[i]) && /^\+\+\+\s+/.test(lines[i + 1])) starts.push(i);
        }
    }

    const openingFenceMatch = starts.length > 0 && starts[0] > 0
        ? lines[starts[0] - 1].match(/^(`{3,}|~{3,})diff\s*$/i)
        : null;
    const outerFence = openingFenceMatch ? openingFenceMatch[1] : null;

    const files = [];
    for (let index = 0; index < starts.length; index++) {
        const start = starts[index];
        let end = index + 1 < starts.length ? starts[index + 1] : lines.length;

        // Remove only the fence paired with the known outer opening fence.
        // A shorter fence may be legitimate context inside a Markdown file.
        if (outerFence && index === starts.length - 1) {
            for (let i = start + 1; i < end; i++) {
                if (lines[i].trim() === outerFence) {
                    end = i;
                    break;
                }
            }
        }

        const patchLines = lines.slice(start, end);
        let oldHeader = null;
        let newHeader = null;
        let diffHeaderPath = null;

        const diffHeader = patchLines[0].match(/^diff --git\s+(?:"?a\/(.+?)"?)\s+(?:"?b\/(.+?)"?)\s*$/);
        if (diffHeader) diffHeaderPath = normalizeDiffPath(diffHeader[2]);

        for (const line of patchLines) {
            if (oldHeader === null) {
                const match = line.match(/^---\s+(.+)$/);
                if (match) oldHeader = match[1];
            }
            if (newHeader === null) {
                const match = line.match(/^\+\+\+\s+(.+)$/);
                if (match) newHeader = match[1];
            }
        }

        const filePath = normalizeDiffPath(newHeader) || diffHeaderPath || normalizeDiffPath(oldHeader);
        // Never trim a diff. A line containing one leading space is a real
        // blank context line and participates in the hunk's declared counts.
        const patch = patchLines.join('\n');
        if (isValidFileCandidate(filePath) && /^@@\s+-\d+(?:,\d+)?\s+\+\d+(?:,\d+)?\s+@@/m.test(patch)) {
            files.push({ filePath, content: patch });
        }
    }

    return files;
}

function extractFilesFromRawText(text) {
    const files = [];

    // 1. Canonical git diffs. Paths live inside the patch, so rendered Markdown
    // cannot separate a code block from the heading that named its file.
    files.push(...extractUnifiedDiffFiles(text));

    // 2. Legacy XML format: <file path="...">...</file>
    const xmlFileRegex = /<file\s+path=["']([^"']+)["']\s*>([\s\S]*?)<\/file>/gi;
    let xmlMatch;
    while ((xmlMatch = xmlFileRegex.exec(text)) !== null) {
        const filePath = cleanCandidatePath(xmlMatch[1]);
        const content = xmlMatch[2].trim();
        if (isValidFileCandidate(filePath)) {
            files.push({ filePath, content });
        }
    }

    // 3. Legacy Markdown header + code block (supports 3, 4, 5+ fences)
    const mdHeaderBlockRegex = /(?:^|\n)(?:#{1,6}\s+|(?:\*\*|\*)?(?:File|Path|Filename)?[:\s*]*)(?:(?:\d+[\.\)]|\*|-|\+)\s*)?`?([a-zA-Z0-9_\-.\/]+\.[a-zA-Z0-9_-]+)`?[^\n]*\n+(`{3,5}|~{3,5})[a-zA-Z0-9_-]*\r?\n([\s\S]*?)\r?\n\2/gi;
    let mdMatch;
    while ((mdMatch = mdHeaderBlockRegex.exec(text)) !== null) {
        const filePath = cleanCandidatePath(mdMatch[1]);
        const content = mdMatch[3];
        if (isValidFileCandidate(filePath)) {
            files.push({ filePath, content, isExcerpt: isExcerptMarker(mdMatch[0]) });
        }
    }

    // 4. Natural-language file introduction followed by a code fence, e.g.
    // "Here is the complete file content for `src/example.php`:".
    const proseBlockRegex = /(?:^|\n)([^\n]{1,300})\n+(`{3,}|~{3,})[a-zA-Z0-9_-]*\r?\n([\s\S]*?)\r?\n\2/g;
    let proseMatch;
    while ((proseMatch = proseBlockRegex.exec(text)) !== null) {
        const filePath = extractExplicitFilePathFromText(proseMatch[1]);
        if (filePath) {
            files.push({
                filePath,
                content: proseMatch[3],
                isExcerpt: isExcerptMarker(proseMatch[1])
            });
        }
    }

    return files;
}

function extractFilesFromTurn(turnElement) {
    const rawFiles = [];

    // Mode A: Parse raw message text (works seamlessly for .very-large-text-container and raw markdown)
    const turnText = turnElement.innerText || turnElement.textContent || '';
    const textFiles = extractFilesFromRawText(turnText);
    rawFiles.push(...textFiles);

    // Mode B: Parse DOM <ms-code-block> elements (for standard rendered mode)
    const codeBlocks = turnElement.querySelectorAll('ms-code-block');

    codeBlocks.forEach((codeBlock) => {
        let filePath = null;
        let isExcerpt = false;

        const containerHtml = codeBlock.parentElement ? codeBlock.parentElement.innerHTML : '';
        const tagMatch = containerHtml.match(/<(?:file|artifact|code)[^>]+(?:path|filename|name)=["']([^"']+)["']/i);
        if (tagMatch && isValidFileCandidate(tagMatch[1])) {
            filePath = cleanCandidatePath(tagMatch[1]);
            isExcerpt = isExcerptMarker(containerHtml);
        }

        const codeEl = codeBlock.querySelector('pre code');
        if (!codeEl) return;
        let rawText = codeEl.innerText;

        const embeddedDiffFiles = extractUnifiedDiffFiles(rawText);
        if (embeddedDiffFiles.length > 0) {
            embeddedDiffFiles.forEach(file => rawFiles.push({
                ...file,
                codeBlockElement: codeBlock,
                isExcerpt: false
            }));
            return;
        }

        if (!filePath) {
            const commentMatch = rawText.match(/(?:\/\/|#|\/\*|<!--)\s*(?:filepath:|file:|path:)?\s*(?:(?:\d+[\.\)]|\*|-|\+)\s*)?([a-zA-Z0-9_\-\.\/]+\.[a-zA-Z0-9_-]+)/i);
            if (commentMatch && isValidFileCandidate(commentMatch[1])) {
                filePath = cleanCandidatePath(commentMatch[1]);
            }
        }

        if (!filePath) {
            let prev = codeBlock.previousElementSibling;
            let distance = 0;
            while (prev && distance < 2) {
                if (prev.tagName === 'MS-CODE-BLOCK' || prev.querySelector('ms-code-block') || prev.tagName === 'HR') {
                    break;
                }

                const prevText = prev.innerText.trim();
                if (isExcerptMarker(prevText)) isExcerpt = true;

                if (['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(prev.tagName)) {
                    const labelMatch = prevText.match(/(?:file|path|filename)?[:\s*]*(?:(?:\d+[\.\)]|\*|-|\+)\s*)?[`"]?([a-zA-Z0-9_\-\.\/]+\.[a-zA-Z0-9_-]+)[`"]?/i);
                    if (labelMatch && isValidFileCandidate(labelMatch[1])) {
                        filePath = cleanCandidatePath(labelMatch[1]);
                        break;
                    }
                } else if (['P', 'LI'].includes(prev.tagName)) {
                    const text = prevText;
                    const explicitPath = extractExplicitFilePathFromText(text);
                    const legacyExplicitMatch = text.match(/^(?:(?:###?\s*)?(?:File|Path|Filename):\s*|`)(?:(?:\d+[\.\)]|\*|-|\+)\s*)?([a-zA-Z0-9_\-\.\/]+\.[a-zA-Z0-9_-]+)`?/i);
                    if (explicitPath) {
                        filePath = explicitPath;
                        break;
                    }
                    if (legacyExplicitMatch && isValidFileCandidate(legacyExplicitMatch[1])) {
                        filePath = cleanCandidatePath(legacyExplicitMatch[1]);
                        break;
                    }
                }
                prev = prev.previousElementSibling;
                distance++;
            }
        }

        // A path may have been found in a code comment or tag; still inspect
        // nearby prose so an excerpt marker cannot be missed.
        if (filePath && !isExcerpt) {
            let prev = codeBlock.previousElementSibling;
            let distance = 0;
            while (prev && distance < 3) {
                if (prev.tagName === 'MS-CODE-BLOCK' || prev.querySelector('ms-code-block') || prev.tagName === 'HR') break;
                if (isExcerptMarker(prev.innerText || prev.textContent || '')) {
                    isExcerpt = true;
                    break;
                }
                prev = prev.previousElementSibling;
                distance++;
            }
        }

        if (filePath) {
            rawFiles.push({
                filePath: cleanCandidatePath(filePath),
                content: rawText,
                codeBlockElement: codeBlock,
                isExcerpt
            });
        }
    });

    // Deduplication: prefer a canonical diff and preserve the DOM code-block
    // reference so the per-block Sync button still works.
    const fileMap = new Map();
    for (const file of rawFiles) {
        if (!fileMap.has(file.filePath)) {
            fileMap.set(file.filePath, file);
        } else {
            const existing = fileMap.get(file.filePath);
            const existingIsDiff = isUnifiedDiff(existing.content);
            const candidateIsDiff = isUnifiedDiff(file.content);
            const useCandidate = (candidateIsDiff && !existingIsDiff) ||
                (candidateIsDiff === existingIsDiff && file.content.length > existing.content.length);
            const selected = useCandidate ? file : existing;
            const other = useCandidate ? existing : file;
            if (!selected.codeBlockElement && other.codeBlockElement) {
                selected.codeBlockElement = other.codeBlockElement;
            }
            fileMap.set(file.filePath, selected);
        }
    }

    return Array.from(fileMap.values());
}

// ==========================================
// 11. Execution & UI Injection
// ==========================================

async function syncFileBatch(dirHandle, fileEntries) {
    const processedFiles = [];

    for (const file of fileEntries) {
        const originalText = await readRelativeFile(dirHandle, file.filePath);
        let targetContent = file.content;
        let isDiff = false;
        let hasDiffError = false;
        let diffErrorMsg = '';

        try {
            const result = processDiffOrDirectContent(originalText, file.content);
            targetContent = result.content;
            isDiff = result.isDiff;
        } catch (err) {
            hasDiffError = true;
            diffErrorMsg = err.message;
            // Keep review anchored to the actual file. Treating raw diff text
            // as replacement content produces a misleading full-file rewrite
            // and could write patch syntax into the source file.
            targetContent = originalText || '';
            isDiff = isDiffContent(file.content);
        }

        const validation = validateContent(file.filePath, targetContent);
        const isIdentical = !hasDiffError && originalText !== null && (originalText.replace(/\r\n/g, '\n') === targetContent.replace(/\r\n/g, '\n'));

        processedFiles.push({
            filePath: file.filePath,
            rawBlock: file.content,
            originalContent: originalText,
            targetContent,
            isDiff,
            hasDiffError,
            diffErrorMsg,
            isIdentical,
            isExcerpt: Boolean(file.isExcerpt),
            validation
        });
    }

    if (processedFiles.length > 0 && processedFiles.every(f => f.isIdentical)) {
        showToast(t('allUpToDate'), 'info');
        return { writtenCount: processedFiles.length, skipped: [], alreadyIdentical: true };
    }

    const needsReview = processedFiles.some(f => !f.isIdentical && (!f.validation.valid || f.hasDiffError || f.isDiff || f.isExcerpt));
    let filesToWrite = [];

    if (needsReview || processedFiles.length > 1) {
        filesToWrite = await showBatchReviewModal(processedFiles);
    } else {
        filesToWrite = processedFiles
            .filter(f => !f.isIdentical)
            .map(f => ({ filePath: f.filePath, content: f.targetContent }));
    }

    if (filesToWrite.length === 0) {
        const actualProblemFiles = processedFiles.filter(f => !f.isIdentical);
        return { writtenCount: 0, skipped: actualProblemFiles };
    }

    await recordUndoSnapshot(dirHandle, filesToWrite);

    for (const item of filesToWrite) {
        await writeRelativeFile(dirHandle, item.filePath, item.content);
    }

    const writtenPaths = new Set(filesToWrite.map(f => f.filePath));
    const skipped = processedFiles.filter(f => !writtenPaths.has(f.filePath) && !f.isIdentical);

    return { writtenCount: filesToWrite.length, skipped };
}

async function updateFileStatusBadges(turn) {
    if (!rootDirHandle) return;
    const files = extractFilesFromTurn(turn);

    for (const file of files) {
        if (!file.codeBlockElement || !file.codeBlockElement.querySelector) continue;
        const actionsWrapper = file.codeBlockElement.querySelector('.projected-actions-wrapper');
        if (!actionsWrapper) continue;

        let badge = actionsWrapper.querySelector('.ai-block-badge');
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'ai-file-status-badge ai-block-badge';
            actionsWrapper.prepend(badge);
        }

        const localContent = await readRelativeFile(rootDirHandle, file.filePath);
        const exists = localContent !== null;
        const isDiff = isDiffContent(file.content);
        const isIdentical = exists && (localContent.replace(/\r\n/g, '\n') === file.content.replace(/\r\n/g, '\n'));

        if (file.isExcerpt) {
            badge.className = 'ai-file-status-badge ai-block-badge badge-warn';
            badge.innerText = t('excerpt');
        } else if (isIdentical) {
            badge.className = 'ai-file-status-badge ai-block-badge badge-same';
            badge.innerText = t('statusSame');
        } else if (isDiff) {
            badge.className = 'ai-file-status-badge ai-block-badge badge-diff';
            badge.innerText = t('statusDiff');
        } else if (exists) {
            badge.className = 'ai-file-status-badge ai-block-badge badge-mod';
            badge.innerText = t('statusMod');
        } else {
            badge.className = 'ai-file-status-badge ai-block-badge badge-new';
            badge.innerText = t('statusNew');
        }
    }
}

function injectUI() {
    document.querySelectorAll('ms-chat-turn').forEach((turn) => {
        if (turn.dataset.syncInjected) return;

        const actionsBar = turn.querySelector('.actions-container .actions');
        if (actionsBar) {
            const syncTurnBtn = document.createElement('button');
            syncTurnBtn.className = 'btn-turn-sync';
            syncTurnBtn.innerHTML = `⚡ ${t('syncToDisk')}`;

            syncTurnBtn.onclick = async (e) => {
                e.stopPropagation();
                if (!rootDirHandle) {
                    showToast(t('connectFirst'), 'warning');
                    return;
                }

                const files = extractFilesFromTurn(turn);
                if (files.length === 0) {
                    showToast(t('noValidFiles'), 'warning');
                    return;
                }

                syncTurnBtn.innerText = `⏳ ${t('writing', { count: files.length })}`;
                try {
                    const result = await syncFileBatch(rootDirHandle, files);
                    if (result.alreadyIdentical) {
                        syncTurnBtn.innerText = `✅ ${t('upToDate')}`;
                    } else if (result.writtenCount > 0) {
                        showToast(t('syncSuccess', { count: result.writtenCount }), 'success');
                        syncTurnBtn.innerText = `✅ ${t('synced', { written: result.writtenCount, total: files.length })}`;
                    } else {
                        syncTurnBtn.innerText = `⚡ ${t('syncToDisk')}`;
                    }
                    if (result.skipped && result.skipped.length > 0) {
                        handleSkippedFilesResolution(result.skipped);
                        showToast(t('skippedPrompt', { count: result.skipped.length }), 'info');
                    }
                    setTimeout(() => { syncTurnBtn.innerText = `⚡ ${t('syncToDisk')}`; }, 3000);
                } catch (err) {
                    showToast(t('syncError', { error: err.message }), 'error');
                    syncTurnBtn.innerText = `❌ ${t('error')}`;
                }
            };

            actionsBar.prepend(syncTurnBtn);
        }

        const files = extractFilesFromTurn(turn);
        files.forEach((file) => {
            if (!file.codeBlockElement || !file.codeBlockElement.querySelector) return;
            const actionsWrapper = file.codeBlockElement.querySelector('.projected-actions-wrapper');
            if (actionsWrapper && !actionsWrapper.dataset.syncInjected) {
                const singleBtn = document.createElement('button');
                singleBtn.className = 'btn-block-sync';
                singleBtn.title = t('syncTitle', { path: file.filePath });
                singleBtn.innerHTML = `💾 ${t('sync')}`;

                singleBtn.onclick = async (e) => {
                    e.stopPropagation();
                    if (!rootDirHandle) {
                        showToast(t('connectFirst'), 'warning');
                        return;
                    }
                    try {
                        const result = await syncFileBatch(rootDirHandle, [file]);
                        if (result.alreadyIdentical) {
                            singleBtn.innerHTML = `✅ ${t('upToDate')}`;
                        } else if (result.writtenCount > 0) {
                            showToast(t('attached', { path: file.filePath }), 'success');
                            singleBtn.innerHTML = `✅ ${t('saved')}`;
                        } else {
                            singleBtn.innerHTML = `⚠️ ${t('skipped')}`;
                            if (result.skipped && result.skipped.length > 0) {
                                handleSkippedFilesResolution(result.skipped);
                            }
                        }
                        setTimeout(() => { singleBtn.innerHTML = `💾 ${t('sync')}`; }, 2500);
                    } catch (err) {
                        showToast(t('writeFailed', { error: err.message }), 'error');
                    }
                };

                actionsWrapper.prepend(singleBtn);
                actionsWrapper.dataset.syncInjected = 'true';
            }
        });

        updateFileStatusBadges(turn);
        turn.dataset.syncInjected = 'true';
    });
}

// ==========================================
// 12. Floating Toolbar, Persistence & Context Menu
// ==========================================

async function setupPersistentDirectory() {
    try {
        const stored = await getStoredHandle();
        if (stored) {
            const permission = await stored.queryPermission({ mode: 'readwrite' });
            if (permission === 'granted') {
                rootDirHandle = stored;
                updateFolderStatus(`📂 ${rootDirHandle.name}`, t('change'));
                showToast(t('restored', { name: rootDirHandle.name }), 'info', 2000);
            } else {
                updateFolderStatus(`📂 ${stored.name}`, t('regrant'));
            }
        }
    } catch (e) {
        console.error('Failed to load stored directory handle:', e);
    }
}

function updateFolderStatus(label, btnText) {
    const lbl = document.getElementById('sync-folder-name');
    const btn = document.getElementById('btn-pick-folder');
    if (lbl) lbl.innerText = label;
    if (btn) btn.innerText = btnText;
}

function createFloatingToolbar() {
    if (document.getElementById('ai-studio-sync-bar')) return;

    const bar = document.createElement('div');
    bar.id = 'ai-studio-sync-bar';
    if (['ar', 'ur'].includes(LOCALE)) bar.dir = 'rtl';
    bar.innerHTML = `
        <div class="ai-sync-drag-handle" title="${t('drag')}">⋮⋮</div>
        <span id="sync-folder-name" style="cursor: grab;">📁 ${t('noFolder')}</span>
        <button id="btn-pick-folder">${t('connectRoot')}</button>
        <button id="btn-undo-sync" disabled>↩️ ${t('undo')}</button>
        <button id="btn-context-menu">📎 ${t('context')} ▾</button>
        <div id="ai-sync-context-dropdown" class="ai-sync-dropdown-menu" style="display: none;">
            <button class="ai-sync-dropdown-item ai-sync-dropdown-item-featured" id="btn-pack-context">📊 ${t('packContext')}</button>
            <button class="ai-sync-dropdown-item" id="btn-insert-diff-prompt">📋 ${t('diffInstructions')}</button>
            <button class="ai-sync-dropdown-item" id="btn-attach-tree">🌳 ${t('directoryTree')}</button>
            <button class="ai-sync-dropdown-item" id="btn-attach-file">📄 ${t('attachFile')}</button>
        </div>
    `;

    document.body.appendChild(bar);

    // --- Restore Saved Position ---
    try {
        const savedPos = JSON.parse(localStorage.getItem('ai_studio_sync_bar_pos') || 'null');
        if (savedPos && savedPos.left !== undefined && savedPos.top !== undefined) {
            const clampedLeft = Math.max(10, Math.min(window.innerWidth - 300, savedPos.left));
            const clampedTop = Math.max(10, Math.min(window.innerHeight - 60, savedPos.top));
            bar.style.bottom = 'auto';
            bar.style.right = 'auto';
            bar.style.left = `${clampedLeft}px`;
            bar.style.top = `${clampedTop}px`;
        }
    } catch {
        // Fallback to CSS bottom/right
    }

    // --- Draggable Logic ---
    let isDragging = false;
    let startX = 0, startY = 0;
    let startLeft = 0, startTop = 0;

    function onPointerDown(e) {
        // Only drag when clicking handle, label, or bar body (ignore buttons/inputs)
        if (e.target.closest('button') || e.target.closest('.ai-sync-dropdown-menu')) return;

        isDragging = true;
        bar.classList.add('ai-sync-dragging');

        const rect = bar.getBoundingClientRect();
        startX = e.clientX;
        startY = e.clientY;
        startLeft = rect.left;
        startTop = rect.top;

        // Switch positioning mode to absolute top/left
        bar.style.bottom = 'auto';
        bar.style.right = 'auto';
        bar.style.left = `${startLeft}px`;
        bar.style.top = `${startTop}px`;

        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
    }

    function onPointerMove(e) {
        if (!isDragging) return;

        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;

        const rect = bar.getBoundingClientRect();
        const maxLeft = window.innerWidth - rect.width - 10;
        const maxTop = window.innerHeight - rect.height - 10;

        const newLeft = Math.max(10, Math.min(maxLeft, startLeft + deltaX));
        const newTop = Math.max(10, Math.min(maxTop, startTop + deltaY));

        bar.style.left = `${newLeft}px`;
        bar.style.top = `${newTop}px`;
    }

    function onPointerUp() {
        if (!isDragging) return;
        isDragging = false;
        bar.classList.remove('ai-sync-dragging');

        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);

        // Save position
        const rect = bar.getBoundingClientRect();
        localStorage.setItem('ai_studio_sync_bar_pos', JSON.stringify({ left: rect.left, top: rect.top }));
    }

    bar.addEventListener('pointerdown', onPointerDown);

    // --- Button Actions ---
    const pickBtn = document.getElementById('btn-pick-folder');
    pickBtn.onclick = async () => {
        try {
            const stored = await getStoredHandle();
            if (pickBtn.innerText.includes('Re-grant') && stored) {
                const permission = await stored.requestPermission({ mode: 'readwrite' });
                if (permission === 'granted') {
                    rootDirHandle = stored;
                    updateFolderStatus(`📂 ${rootDirHandle.name}`, t('change'));
                    showToast(t('reconnected', { name: rootDirHandle.name }), 'success');
                    return;
                }
            }

            rootDirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
            await saveStoredHandle(rootDirHandle);
            updateFolderStatus(`📂 ${rootDirHandle.name}`, t('change'));
            showToast(t('connected', { name: rootDirHandle.name }), 'success');
        } catch (err) {
            if (err.name !== 'AbortError') {
                showToast(`Folder connection failed: ${err.message}`, 'error');
            }
        }
    };

    document.getElementById('btn-undo-sync').onclick = () => {
        if (rootDirHandle) performUndo(rootDirHandle);
    };

    const contextBtn = document.getElementById('btn-context-menu');
    const dropdown = document.getElementById('ai-sync-context-dropdown');

    contextBtn.onclick = (e) => {
        e.stopPropagation();
        dropdown.style.display = dropdown.style.display === 'none' ? 'flex' : 'none';
    };

    document.addEventListener('click', () => {
        if (dropdown) dropdown.style.display = 'none';
    });

    document.getElementById('btn-pack-context').onclick = async () => {
        if (!rootDirHandle) {
                showToast(t('connectFirst'), 'warning');
            return;
        }
        showToast(t('scanning'), 'info', 2000);
        try {
            const files = await collectAllRepositoryFiles(rootDirHandle);
            if (files.length === 0) {
                showToast(t('noSource'), 'warning');
                return;
            }
            await showContextPackerModal(files, rootDirHandle.name);
        } catch (err) {
            showToast(t('packingFailed', { error: err.message }), 'error');
        }
    };

    document.getElementById('btn-insert-diff-prompt').onclick = insertStrictSyncFormatPrompt;

    document.getElementById('btn-attach-tree').onclick = async () => {
        if (!rootDirHandle) {
            showToast(t('connectFirst'), 'warning');
            return;
        }
        showToast(t('generatingTree'), 'info', 1500);
        try {
            const files = await collectAllRepositoryFiles(rootDirHandle);
            const paths = files.map(f => f.filePath).sort();
            const tree = buildTreeFromPaths(paths);
            await insertIntoPrompt(`Project Directory Structure:\n\`\`\`\n${tree}\`\`\``);
            showToast(t('treeAdded'), 'success');
        } catch (err) {
            showToast(t('treeFailed', { error: err.message }), 'error');
        }
    };

    document.getElementById('btn-attach-file').onclick = async () => {
        if (!rootDirHandle) {
            showToast(t('connectFirst'), 'warning');
            return;
        }
        const relPath = prompt(t('filePathPrompt'));
        if (!relPath) return;

        try {
            const content = await readRelativeFile(rootDirHandle, relPath.trim());
            if (content === null) {
                showToast(t('fileNotFound', { path: relPath }), 'error');
                return;
            }
            const ext = relPath.split('.').pop() || '';
            await insertIntoPrompt(`### File: \`${relPath}\`\n\`\`\`${ext}\n${content}\n\`\`\``);
            showToast(t('attached', { path: relPath }), 'success');
        } catch (err) {
            showToast(t('readFailed', { error: err.message }), 'error');
        }
    };
}

// ==========================================
// 13. Initialization
// ==========================================

if (typeof document !== 'undefined') {
    createFloatingToolbar();
    setupPersistentDirectory();

    const observer = new MutationObserver(() => {
        injectUI();
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        applySearchReplace,
        applyUnifiedPatch,
        extractFilesFromRawText,
        extractUnifiedDiffFiles,
        isDiffContent,
        processDiffOrDirectContent,
        stripOuterMarkdownFence
    };
}
