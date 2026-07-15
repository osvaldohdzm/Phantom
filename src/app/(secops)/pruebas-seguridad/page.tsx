'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Shield,
  Search,
  Filter,
  Plus,
  Play,
  CheckCircle,
  Clock,
  Trash2,
  Check,
  X,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Edit2,
  Save,
  Terminal,
  Copy,
  LayoutGrid,
  Table,
  Download,
  FolderOpen,
  ArrowUpDown,
  CheckSquare,
  Square,
  ChevronsUpDown,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PRUEBAS_INITIAL, type SecurityTestItem } from '@/lib/data-pruebas';

interface ActiveTestSuiteInstance {
  id: string;
  name: string;
  projectName: string;
  framework: string;
  createdAt: string;
  tests: SecurityTestItem[];
}

export default function SecurityTestsActivePage() {
  const [instances, setInstances] = useState<ActiveTestSuiteInstance[]>([]);
  const [selectedSuiteId, setSelectedSuiteId] = useState<string>('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchTests, setSearchTests] = useState('');
  const [expandedTestId, setExpandedTestId] = useState<number | null>(null);

  // View mode: 'cards' or 'matrix'
  const [viewMode, setViewMode] = useState<'cards' | 'matrix'>('matrix');

  // Form State for new suite instance
  const [newSuiteName, setNewSuiteName] = useState('');
  const [newSuiteProject, setNewSuiteProject] = useState('');

  // Editing state for card details
  const [editingTestId, setEditingTestId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<SecurityTestItem>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Sorting state for matrix columns
  const [sortConfig, setSortConfig] = useState<{ key: keyof SecurityTestItem; direction: 'asc' | 'desc' } | null>(null);

  // Multi-row selection state
  const [selectedTestIds, setSelectedTestIds] = useState<number[]>([]);

  // Excel columns dynamic widths state (64 items: Checkbox + 63 columns)
  const [colWidths, setColWidths] = useState<number[]>([
    35,   // 0. Checkbox
    45,   // 1. Id
    180,  // 2. Id de Servicio
    95,   // 3. Plataforma
    120,  // 4. Servicio Tecnológico
    150,  // 5. Id de Prueba de Seguridad
    220,  // 6. Evaluación Asociada
    150,  // 7. Categoria
    280,  // 8. Nombre de la Prueba
    130,  // 9. Resultado de la Prueba / Estado de la Prueba
    220,  // 10. Comentarios de la Prueba
    130,  // 11. Clasificación
    220,  // 12. Nombre de Hallazgo
    280,  // 13. Descripción de la Prueba
    150,  // 14. Single Target
    280,  // 15. Prueba con Comando de Terminal Sugerido Para Bulk Targets
    120,  // 16. Targets File
    280,  // 17. Prueba con Comando de Terminal Sugerido Para Single Target
    250,  // 18. Verificación con Filtro de BurpSuite HTTP History Sugerido
    250,  // 19. Verificación con Filtro de BurpSuite Search Sugerido
    150,  // 20. BurpSuite File
    250,  // 21. Verificación con Comándo de Terminal Sugerido Para BurpSuite File
    250,  // 22. Verificación con Snippet de Consola de Desarrollador en Navegador con Archivo HAR
    // 23-34. Evidencias
    140, 140, 140, 140, 140, 140, 140, 140, 140, 140, 140, 140,
    140,  // 35. Herramienta Sugerida
    180,  // 36. Herramienta que Incluye la Prueba
    200,  // 37. Referencias
    150,  // 38. Táctica MITRE
    150,  // 39. Técnica MITRE
    120,  // 40. ID MITRE
    110,  // 41. Folio2
    120,  // 42. Fecha de detección
    160,  // 43. Nombre de activo tecnológico
    160,  // 44. Servicio de seguridad asociado
    120,  // 45. Tipo de revisión
    160,  // 46. Activo objetivo de prueba de seguridad
    180,  // 47. Nombre de prueba seguridad
    220,  // 48. Descripción de la prueba de seguridad
    120,  // 49. Resultado de la prueba2
    150,  // 50. Evidencia principal
    180,  // 51. Notas de la prueba de seguridad
    140,  // 52. Evidencia complementaria 1
    140,  // 53. Evidencia complementaria 2
    140,  // 54. Evidencia complementaria 3
    220,  // 55. Descripción
    180,  // 56. Amenaza
    220,  // 57. Recomendaciones
    220,  // 58. Prueba de Concepto
    100,  // 59. CWE
    150,  // 60. FQDN
    120,  // 61. Ambiente
    100,  // 62. CVSS Score
    180   // 63. CVSS Vector
  ]);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('spectre_active_test_suites');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setInstances(parsed);
        if (parsed.length > 0) {
          setSelectedSuiteId(parsed[0].id);
        }
      } catch (e) {
        console.error(e);
      }
    } else {
      // Seed default suite if empty
      const defaults = [
        {
          id: 'suite-1',
          name: 'Prueba de Pentest WSTG - Banco Digital',
          projectName: 'Digital Banking Portal (EIM ID – 9847446)',
          framework: 'CROS Web Application Security Testing (WSTG) v2.0.0',
          createdAt: '2026-07-02',
          tests: PRUEBAS_INITIAL.map((t) => ({ ...t })),
        },
      ];
      setInstances(defaults);
      setSelectedSuiteId('suite-1');
      localStorage.setItem('spectre_active_test_suites', JSON.stringify(defaults));
    }
  }, []);

  const selectedSuite = useMemo(() => {
    return instances.find((inst) => inst.id === selectedSuiteId) || instances[0];
  }, [instances, selectedSuiteId]);

  // Helper to persist instances change
  const saveSuiteInstances = (newInsts: ActiveTestSuiteInstance[]) => {
    setInstances(newInsts);
    localStorage.setItem('spectre_active_test_suites', JSON.stringify(newInsts));
  };

  // Create active suite from catalog templates
  const handleCreateSuite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSuiteName.trim() || !newSuiteProject.trim()) return;

    const newSuite: ActiveTestSuiteInstance = {
      id: `suite-${Date.now()}`,
      name: newSuiteName,
      projectName: newSuiteProject,
      framework: 'CROS Web Application Security Testing (WSTG) v2.0.0',
      createdAt: new Date().toISOString().split('T')[0],
      tests: PRUEBAS_INITIAL.map((t) => ({
        ...t,
        resultadoPrueba: 'PENDING',
        comentariosPrueba: '',
        singleTarget: '',
        targetsFile: 'BurpItems.txt',
        evidencias: [],
      })),
    };

    const updated = [newSuite, ...instances];
    saveSuiteInstances(updated);
    setSelectedSuiteId(newSuite.id);
    setShowCreateModal(false);
    setNewSuiteName('');
    setNewSuiteProject('');
  };

  // Delete active suite
  const handleDeleteSuite = (id: string) => {
    const updated = instances.filter((s) => s.id !== id);
    saveSuiteInstances(updated);
    if (selectedSuiteId === id && updated.length > 0) {
      setSelectedSuiteId(updated[0].id);
    }
  };

  // Edit / Save details of a test case
  const startEditing = (test: SecurityTestItem) => {
    setEditingTestId(test.id);
    setEditForm({ ...test });
  };

  const saveEdit = () => {
    if (editingTestId === null || !selectedSuite) return;

    const updated = instances.map((inst) => {
      if (inst.id !== selectedSuiteId) return inst;
      return {
        ...inst,
        tests: inst.tests.map((t) =>
          t.id === editingTestId ? ({ ...t, ...editForm } as SecurityTestItem) : t
        ),
      };
    });

    saveSuiteInstances(updated);
    setEditingTestId(null);
    setEditForm({});
  };

  // Inline Excel Cell Updates (Matrix mode)
  const handleMatrixCellUpdate = (testId: number, field: keyof SecurityTestItem, value: any) => {
    const updated = instances.map((inst) => {
      if (inst.id !== selectedSuiteId) return inst;
      return {
        ...inst,
        tests: inst.tests.map((t) => (t.id === testId ? ({ ...t, [field]: value } as SecurityTestItem) : t)),
      };
    });
    saveSuiteInstances(updated);
  };

  // Inline Evidence array cell updates (Matrix mode)
  const handleMatrixEvidenceUpdate = (testId: number, idx: number, field: 'imagen' | 'nota', value: string) => {
    const updated = instances.map((inst) => {
      if (inst.id !== selectedSuiteId) return inst;
      return {
        ...inst,
        tests: inst.tests.map((t) => {
          if (t.id !== testId) return t;
          const current = [...t.evidencias];
          while (current.length <= idx) {
            current.push({ imagen: '', nota: '' });
          }
          current[idx] = { ...current[idx], [field]: value };
          return { ...t, evidencias: current } as SecurityTestItem;
        }),
      };
    });
    saveSuiteInstances(updated);
  };

  // Add mock evidence item to editForm
  const addEvidence = () => {
    const currentEvidencias = editForm.evidencias || [];
    setEditForm((f) => ({
      ...f,
      evidencias: [
        ...currentEvidencias,
        { imagen: `EVIDENCIA_${currentEvidencias.length + 1}.png`, nota: '' },
      ],
    }));
  };

  const removeEvidence = (idx: number) => {
    const currentEvidencias = editForm.evidencias || [];
    setEditForm((f) => ({
      ...f,
      evidencias: currentEvidencias.filter((_, i) => i !== idx),
    }));
  };

  const updateEvidence = (idx: number, field: 'imagen' | 'nota', val: string) => {
    const currentEvidencias = editForm.evidencias || [];
    setEditForm((f) => ({
      ...f,
      evidencias: currentEvidencias.map((ev, i) =>
        i === idx ? { ...ev, [field]: val } : ev
      ),
    }));
  };

  // Filter test cases
  const filteredTests = useMemo(() => {
    if (!selectedSuite) return [];
    return selectedSuite.tests.filter((t) => {
      return (
        t.idPruebaSeguridad.toLowerCase().includes(searchTests.toLowerCase()) ||
        t.nombrePrueba.toLowerCase().includes(searchTests.toLowerCase()) ||
        (t.nombreHallazgo || '').toLowerCase().includes(searchTests.toLowerCase())
      );
    });
  }, [selectedSuite, searchTests]);

  // Sorting keys mapping
  const EXCEL_KEYS = useMemo<(keyof SecurityTestItem)[]>(() => [
    'id', // Checkbox key (placeholder)
    'id',
    'idServicio',
    'plataforma',
    'servicioTecnologico',
    'idPruebaSeguridad',
    'evaluacionAsociada',
    'categoria',
    'nombrePrueba',
    'resultadoPrueba',
    'comentariosPrueba',
    'clasificacion',
    'nombreHallazgo',
    'descripcionPrueba',
    'singleTarget',
    'comandoBulk',
    'targetsFile',
    'comandoSingle',
    'filtroBurpHistory',
    'filtroBurpSearch',
    'burpSuiteFile',
    'comandoBurpFile',
    'snippetDeveloperConsole',
    // Evidencias placeholders
    'id', 'id', 'id', 'id', 'id', 'id', 'id', 'id', 'id', 'id', 'id', 'id',
    'herramientaSugerida',
    'herramientaIncluyePrueba',
    'referencias',
    'mitreTactica',
    'mitreTecnica',
    'mitreId',
    'folio2',
    'fechaDeteccion',
    'nombreActivoTecnologico',
    'servicioSeguridadAsociado',
    'tipoRevision',
    'activoObjetivoPruebaSeguridad',
    'nombrePruebaSeguridad',
    'descripcionPruebaSeguridad',
    'resultadoPrueba2',
    'evidenciaPrincipal',
    'notasPruebaSeguridad',
    'evidenciaComplementaria1',
    'evidenciaComplementaria2',
    'evidenciaComplementaria3',
    'descripcion',
    'amenaza',
    'recomendaciones',
    'poc',
    'cwe',
    'fqdn',
    'ambiente',
    'cvssScore',
    'cvssVector'
  ], []);

  // Sort Routine
  const sortedTests = useMemo(() => {
    let items = [...filteredTests];
    if (sortConfig) {
      items.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        if (aValue === undefined || aValue === null) return 1;
        if (bValue === undefined || bValue === null) return -1;
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return items;
  }, [filteredTests, sortConfig]);

  // Handle click header sorting
  const handleSort = (colIndex: number) => {
    if (colIndex === 0) return; // Checkbox column is not sortable
    const key = EXCEL_KEYS[colIndex];
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Drag-to-Resize Column handler
  const handleMouseDown = (index: number, e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.pageX;
    const startWidth = colWidths[index] || 150;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.max(30, startWidth + (moveEvent.pageX - startX));
      setColWidths((prev) => {
        const updated = [...prev];
        updated[index] = newWidth;
        return updated;
      });
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Substitute target in command templates dynamically
  const substituteCommand = (rawCommand: string, target: string, file: string) => {
    if (!rawCommand) return '';
    let cmd = rawCommand;
    if (file) {
      cmd = cmd.replace(/BurpItems\.txt/g, file);
    }
    if (target) {
      cmd = cmd.replace(/\{\{TARGET\}\}/g, target);
    }
    return cmd;
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Select rows helper
  const isAllSelected = sortedTests.length > 0 && selectedTestIds.length === sortedTests.length;
  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedTestIds([]);
    } else {
      setSelectedTestIds(sortedTests.map((t) => t.id));
    }
  };

  const toggleSelectOne = (id: number) => {
    setSelectedTestIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Bulk Actions
  const handleBulkStatusChange = (status: string) => {
    const updated = instances.map((inst) => {
      if (inst.id !== selectedSuiteId) return inst;
      return {
        ...inst,
        tests: inst.tests.map((t) =>
          selectedTestIds.includes(t.id) ? ({ ...t, resultadoPrueba: status } as SecurityTestItem) : t
        ),
      };
    });
    saveSuiteInstances(updated);
    setSelectedTestIds([]);
  };

  const handleBulkDelete = () => {
    const updated = instances.map((inst) => {
      if (inst.id !== selectedSuiteId) return inst;
      return {
        ...inst,
        tests: inst.tests.filter((t) => !selectedTestIds.includes(t.id)),
      };
    });
    saveSuiteInstances(updated);
    setSelectedTestIds([]);
  };

  // Add Custom Row directly inside spreadsheet Matrix
  const handleAddMatrixRow = () => {
    if (!selectedSuite) return;
    const newId = Math.max(...selectedSuite.tests.map((t) => t.id), 0) + 1;
    const newTestRow: SecurityTestItem = {
      id: newId,
      idServicio: selectedSuite.projectName,
      plataforma: 'NETWORK',
      servicioTecnologico: 'HTTP/HTTPS',
      idPruebaSeguridad: `CUSTOM-TEST-${newId}`,
      evaluacionAsociada: selectedSuite.framework,
      categoria: 'Custom_Scans',
      nombrePrueba: 'Prueba ofensiva manual personalizada',
      resultadoPrueba: 'PENDING',
      comentariosPrueba: '',
      clasificacion: '',
      nombreHallazgo: '',
      descripcionPrueba: 'Descripción del análisis ofensivo realizado.',
      singleTarget: '',
      comandoBulk: '',
      targetsFile: 'BurpItems.txt',
      comandoSingle: '',
      filtroBurpHistory: '',
      filtroBurpSearch: '',
      burpSuiteFile: '',
      comandoBurpFile: '',
      snippetDeveloperConsole: '',
      evidencias: [],
      herramientaSugerida: 'Manual',
      herramientaIncluyePrueba: 'Spectre API',
      referencias: 'N/A',
      mitreTactica: 'Discovery',
      mitreTecnica: 'Manual Analysis',
      mitreId: 'T1018',
      cwe: 'CWE-200',
      fqdn: '',
      ambiente: 'Desarrollo',
      cvssScore: 0,
      cvssVector: '',
    };

    const updated = instances.map((inst) => {
      if (inst.id !== selectedSuiteId) return inst;
      return {
        ...inst,
        tests: [...inst.tests, newTestRow],
      };
    });
    saveSuiteInstances(updated);
  };

  // CSV Export for Excel Matrix View
  const handleExportCSV = () => {
    if (!selectedSuite) return;
    const headers = [
      'Id',
      'ID de Servicio',
      'Plataforma',
      'Servicio Tecnológico',
      'ID Prueba Seguridad',
      'Nombre de Prueba',
      'Resultado/Estado',
      'Target',
      'Targets File',
      'Hallazgo',
      'CVSS Score',
      'Comentarios',
    ];

    const rows = selectedSuite.tests.map((t) => [
      t.id,
      t.idServicio,
      t.plataforma,
      t.servicioTecnologico,
      t.idPruebaSeguridad,
      t.nombrePrueba,
      t.resultadoPrueba,
      t.singleTarget,
      t.targetsFile,
      t.nombreHallazgo,
      t.cvssScore,
      t.comentariosPrueba,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(','))].join(
        '\n'
      );

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${selectedSuite.name.replace(/\s+/g, '_')}_matrix.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const EXCEL_HEADERS = [
    '✓', // Column 0: Checkbox
    'Id',
    'Id de Servicio',
    'Plataforma',
    'Servicio Tecnológico',
    'Id de Prueba de Seguridad',
    'Evaluación Asociada',
    'Categoria',
    'Nombre de la Prueba',
    'Resultado de la Prueba / Estado de la Prueba',
    'Comentarios de la Prueba',
    'Clasificación',
    'Nombre de Hallazgo',
    'Descripción de la Prueba',
    'Single Target',
    'Prueba con Comando de Terminal Sugerido Para Bulk Targets',
    'Targets File',
    'Prueba con Comando de Terminal Sugerido Para Single Target',
    'Verificación con Filtro de BurpSuite HTTP History Sugerido',
    'Verificación con Filtro de BurpSuite Search Sugerido',
    'BurpSuite File',
    'Verificación con Comándo de Terminal Sugerido Para BurpSuite File',
    'Verificación con Snippet de Consola de Desarrollador en Navegador con Archivo HAR',
    'Evidencia 1 Imagen', 'Evidencia 1 Nota',
    'Evidencia 2 Imagen', 'Evidencia 2 Nota',
    'Evidencia 3 Imagen', 'Evidencia 3 Nota',
    'Evidencia 4 Imagen', 'Evidencia 4 Nota',
    'Evidencia 5 Imagen', 'Evidencia 5 Nota',
    'Evidencia 6 Imagen', 'Evidencia 6 Nota',
    'Herramienta Sugerida',
    'Herramienta que Incluye la Prueba',
    'Referencias',
    'Táctica MITRE',
    'Técnica MITRE',
    'ID MITRE',
    'Folio2',
    'Fecha de detección',
    'Nombre de activo tecnológico',
    'Servicio de seguridad asociado',
    'Tipo de revisión',
    'Activo objetivo de prueba de seguridad',
    'Nombre de prueba seguridad',
    'Descripción de la prueba de seguridad',
    'Resultado de la prueba2',
    'Evidencia principal',
    'Notas de la prueba de seguridad',
    'Evidencia complementaria 1',
    'Evidencia complementaria 2',
    'Evidencia complementaria 3',
    'Descripción',
    'Amenaza',
    'Recomendaciones',
    'Prueba de Concepto',
    'CWE',
    'FQDN',
    'Ambiente',
    'CVSS Score',
    'CVSS Vector',
  ];

  // Active Suite statistics
  const suiteStats = useMemo(() => {
    if (!selectedSuite) return { testsCount: 0, passedCount: 0, failedCount: 0, progressPercent: 0 };
    const testsCount = selectedSuite.tests.length;
    const passedCount = selectedSuite.tests.filter((t) => t.resultadoPrueba === 'PASSED').length;
    const failedCount = selectedSuite.tests.filter((t) => t.resultadoPrueba === 'FAILED').length;
    const progressPercent = testsCount > 0 ? Math.round(((passedCount + failedCount) / testsCount) * 100) : 0;
    return { testsCount, passedCount, failedCount, progressPercent };
  }, [selectedSuite]);

  return (
    <div className="p-6 md:p-10 max-w-[100%] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Shield className="size-8 text-cyan-500 animate-pulse" />
            Pruebas de Seguridad Activas
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl text-xs">
            Ejecuta y documenta casos de prueba técnicos instanciados desde el Catálogo de Pruebas de Seguridad.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Toggle view mode */}
          <div className="flex border border-border/40 bg-muted/40 rounded-lg p-0.5 text-xs">
            <button
              onClick={() => setViewMode('cards')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
                viewMode === 'cards'
                  ? 'bg-cyan-600 text-white font-semibold'
                  : 'text-muted-foreground hover:bg-muted/80'
              }`}
            >
              <LayoutGrid className="size-3.5" />
              Vista Detallada
            </button>
            <button
              onClick={() => setViewMode('matrix')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
                viewMode === 'matrix'
                  ? 'bg-cyan-600 text-white font-semibold'
                  : 'text-muted-foreground hover:bg-muted/80'
              }`}
            >
              <Table className="size-3.5" />
              Matriz Excel
            </button>
          </div>

          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-cyan-600 hover:bg-cyan-700 text-white font-semibold text-xs flex items-center gap-1 px-4 py-2 rounded-lg"
          >
            <Plus className="size-4" />
            Nueva Suite
          </Button>
        </div>
      </div>

      {/* Top Selector Bar (Full Width) */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-card/60 border border-border/40 p-4 rounded-xl shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="flex items-center gap-1.5 text-cyan-500">
              <FolderOpen className="size-4" />
              Suite de Pruebas Seleccionada:
            </span>
            <select
              value={selectedSuiteId}
              onChange={(e) => setSelectedSuiteId(e.target.value)}
              className="h-9 rounded-lg border border-border/50 bg-background/50 px-3 text-xs text-foreground font-semibold focus:ring-1 focus:ring-cyan-500 focus:outline-none min-w-[280px]"
            >
              {instances.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.name} ({inst.projectName})
                </option>
              ))}
            </select>
          </label>

          {selectedSuite && (
            <button
              onClick={() => handleDeleteSuite(selectedSuite.id)}
              className="h-8 text-rose-500 hover:text-rose-600 hover:bg-rose-500/5 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 px-3 rounded-lg border border-rose-500/20 bg-background/30 transition-all self-end md:self-auto"
            >
              <Trash2 className="size-3.5" />
              Eliminar
            </button>
          )}
        </div>

        {/* Mini progress widget */}
        {selectedSuite && (
          <div className="flex items-center gap-4 self-end md:self-auto bg-muted/20 px-4 py-2 rounded-lg border border-border/20 text-xs font-mono">
            <div>
              <div className="flex justify-between items-center text-[10px] text-muted-foreground gap-8">
                <span>Progreso:</span>
                <span>
                  {suiteStats.passedCount + suiteStats.failedCount}/{suiteStats.testsCount} ({suiteStats.progressPercent}%)
                </span>
              </div>
              <div className="h-1.5 w-40 bg-muted rounded-full overflow-hidden mt-1">
                <div
                  className="h-full bg-cyan-500 transition-all duration-500"
                  style={{ width: `${suiteStats.progressPercent}%` }}
                />
              </div>
            </div>
            <div className="text-[10px] text-muted-foreground">
              <span className="text-emerald-500 block font-bold font-mono">PASSED: {suiteStats.passedCount}</span>
              <span className="text-rose-500 block font-bold font-mono">FAILED: {suiteStats.failedCount}</span>
            </div>
          </div>
        )}
      </div>

      {/* Bulk Actions Toolbar (Only when rows are selected) */}
      {selectedTestIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 bg-cyan-600/10 border border-cyan-500/30 p-3 rounded-xl animate-in slide-in-from-top duration-300 w-full text-xs font-sans">
          <span className="font-bold text-cyan-600 dark:text-cyan-400 font-mono pr-2">
            [{selectedTestIds.length}] Filas Seleccionadas:
          </span>
          <Button
            onClick={() => handleBulkStatusChange('PASSED')}
            className="h-7 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[10px] px-2.5 rounded"
          >
            Marcar PASSED
          </Button>
          <Button
            onClick={() => handleBulkStatusChange('FAILED')}
            className="h-7 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-[10px] px-2.5 rounded"
          >
            Marcar FAILED
          </Button>
          <Button
            onClick={() => handleBulkStatusChange('PENDING')}
            className="h-7 bg-slate-600 hover:bg-slate-700 text-white font-semibold text-[10px] px-2.5 rounded"
          >
            Marcar PENDING
          </Button>
          <Button
            onClick={handleBulkDelete}
            className="h-7 bg-rose-500/10 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:text-white hover:bg-rose-600 font-semibold text-[10px] px-2.5 rounded border border-rose-500/20 dark:border-rose-500/30 ml-auto flex items-center gap-1"
          >
            <Trash2 className="size-3" />
            Eliminar Filas
          </Button>
        </div>
      )}

      {/* Main Suite Content (Full Width) */}
      {selectedSuite ? (
        <div className="space-y-4 w-full">
          {/* Header filters */}
          <Card className="border-border/40 bg-card/60 rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 bg-muted/10 flex items-center justify-between gap-4">
              <div className="relative max-w-xs grow">
                <Search className="absolute left-2.5 top-2 size-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Filtrar casos de prueba..."
                  value={searchTests}
                  onChange={(e) => setSearchTests(e.target.value)}
                  className="w-full h-8 pl-8 pr-4 rounded-lg border border-input bg-background/50 text-[11px] focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-2">
                {viewMode === 'matrix' && (
                  <>
                    <Button
                      onClick={handleAddMatrixRow}
                      className="h-8 bg-cyan-600/20 hover:bg-cyan-600/35 text-cyan-600 dark:text-cyan-400 text-[11px] flex items-center gap-1 border border-cyan-500/30 rounded-lg px-3 py-1 font-semibold"
                    >
                      <Plus className="size-3.5" />
                      Agregar Fila
                    </Button>
                    <Button
                      onClick={handleExportCSV}
                      className="h-8 bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 text-[11px] flex items-center gap-1 border border-border/40 rounded-lg px-3 py-1"
                    >
                      <Download className="size-3.5" />
                      Exportar CSV
                    </Button>
                  </>
                )}
              </div>
            </div>
          </Card>

          {/* Render view mode */}
          {viewMode === 'cards' ? (
            /* CARD VIEW ACCORDION - FULL WIDTH */
            <div className="space-y-3 w-full">
              {sortedTests.map((test) => {
                const isExpanded = expandedTestId === test.id;
                const isEditing = editingTestId === test.id;

                return (
                  <Card
                    key={test.id}
                    className={`border-border/40 hover:border-cyan-500/30 bg-card/50 transition-all rounded-xl overflow-hidden shadow-sm ${
                      isExpanded ? 'ring-1 ring-cyan-500/20' : ''
                    }`}
                  >
                    <div
                      onClick={() => !isEditing && setExpandedTestId(isExpanded ? null : test.id)}
                      className="p-4 flex flex-wrap items-center justify-between gap-4 cursor-pointer select-none"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className={`p-1.5 rounded-lg shrink-0 ${
                          test.resultadoPrueba === 'FAILED'
                            ? 'bg-rose-500/10 text-rose-500'
                            : test.resultadoPrueba === 'PASSED'
                              ? 'bg-emerald-500/10 text-emerald-500'
                              : 'bg-muted text-muted-foreground'
                        }`}>
                          <Shield className="size-4" />
                        </div>
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center flex-wrap gap-2">
                            <span className="font-mono text-[10px] font-bold text-foreground bg-muted px-1.5 py-0.5 rounded">
                              {test.idPruebaSeguridad}
                            </span>
                            <span className="text-[9px] text-muted-foreground font-mono">
                              {test.servicioTecnologico} · {test.plataforma}
                            </span>
                          </div>
                          <h4 className="text-xs font-semibold text-foreground truncate max-w-[280px] sm:max-w-[500px]">
                            {test.nombrePrueba}
                          </h4>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className={`text-[9px] font-bold uppercase rounded-full px-2 py-0.5 border ${
                          test.resultadoPrueba === 'FAILED'
                            ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20'
                            : test.resultadoPrueba === 'PASSED'
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                              : 'bg-muted text-muted-foreground border-border'
                        }`}>
                          {test.resultadoPrueba}
                        </span>

                        {!isExpanded && <ChevronRight className="size-4 text-muted-foreground" />}
                        {isExpanded && <ChevronDown className="size-4 text-muted-foreground" />}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-border/20 p-5 bg-muted/10 space-y-6 text-xs text-muted-foreground">
                        {/* Action panel */}
                        <div className="flex justify-between items-center bg-background/50 border border-border/30 rounded-lg p-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-foreground">
                            {isEditing ? 'Modo de Edición Activo' : 'Detalles de Ejecución'}
                          </span>
                          {isEditing ? (
                            <Button
                              onClick={saveEdit}
                              className="h-7 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[10px] flex items-center gap-1 py-1 rounded"
                            >
                              <Save className="size-3" />
                              Guardar Cambios
                            </Button>
                          ) : (
                            <Button
                              onClick={() => startEditing(test)}
                              className="h-7 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold text-[10px] flex items-center gap-1 py-1 rounded"
                            >
                              <Edit2 className="size-3" />
                              Editar Prueba
                            </Button>
                          )}
                        </div>

                        {isEditing ? (
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <label className="text-[10px] font-bold text-muted-foreground flex flex-col gap-1.5">
                                Resultado / Estado de Prueba:
                                <select
                                  value={editForm.resultadoPrueba || ''}
                                  onChange={(e) => setEditForm((f) => ({ ...f, resultadoPrueba: e.target.value }))}
                                  className="h-8 rounded border border-input bg-background/60 px-2 text-xs focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                                >
                                  <option value="PENDING">PENDING</option>
                                  <option value="PASSED">PASSED</option>
                                  <option value="FAILED">FAILED</option>
                                  <option value="Out Of Scope">Out Of Scope</option>
                                </select>
                              </label>

                              <label className="text-[10px] font-bold text-muted-foreground flex flex-col gap-1.5">
                                Nombre del Hallazgo (si aplica):
                                <input
                                  type="text"
                                  value={editForm.nombreHallazgo || ''}
                                  onChange={(e) => setEditForm((f) => ({ ...f, nombreHallazgo: e.target.value }))}
                                  className="h-8 rounded border border-input bg-background/60 px-2 text-xs focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                                />
                              </label>

                              <label className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 flex flex-col gap-1.5">
                                Target (Objetivo FQDN / IP):
                                <input
                                  type="text"
                                  value={editForm.singleTarget || ''}
                                  onChange={(e) => setEditForm((f) => ({ ...f, singleTarget: e.target.value }))}
                                  className="h-8 rounded border border-input bg-background/60 px-2 text-xs focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                                />
                              </label>

                              <label className="text-[10px] font-bold text-muted-foreground flex flex-col gap-1.5">
                                Targets File (Archivo bulk):
                                <input
                                  type="text"
                                  value={editForm.targetsFile || ''}
                                  onChange={(e) => setEditForm((f) => ({ ...f, targetsFile: e.target.value }))}
                                  className="h-8 rounded border border-input bg-background/60 px-2 text-xs focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                                />
                              </label>

                              <label className="text-[10px] font-bold text-muted-foreground flex flex-col gap-1.5 md:col-span-2">
                                Comentarios / Descargos de la Prueba:
                                <textarea
                                  rows={2}
                                  value={editForm.comentariosPrueba || ''}
                                  onChange={(e) => setEditForm((f) => ({ ...f, comentariosPrueba: e.target.value }))}
                                  className="p-2 rounded border border-input bg-background/60 text-xs focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                                />
                              </label>
                            </div>

                            {/* Evidences list */}
                            <div className="space-y-3 pt-3 border-t border-border/20">
                              <div className="flex justify-between items-center">
                                <span className="text-[10px] font-bold uppercase text-foreground">Evidencias Adjuntas</span>
                                <Button
                                  type="button"
                                  onClick={addEvidence}
                                  className="h-6 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-600 dark:text-cyan-400 text-[10px] px-2 py-0.5 rounded border border-cyan-500/20"
                                >
                                  + Agregar Evidencia
                                </Button>
                              </div>

                              <div className="space-y-2">
                                {(editForm.evidencias || []).map((ev, idx) => (
                                  <div key={idx} className="p-3 bg-background/40 border border-border/40 rounded-xl space-y-2 flex flex-col">
                                    <div className="flex items-center justify-between gap-3">
                                      <label className="text-[9px] font-bold text-muted-foreground grow">
                                        Archivo de Imagen:
                                        <input
                                          type="text"
                                          value={ev.imagen}
                                          onChange={(e) => updateEvidence(idx, 'imagen', e.target.value)}
                                          className="h-7 w-full rounded border border-input bg-background/50 px-2 text-xs focus:ring-1 focus:ring-cyan-500 focus:outline-none mt-1"
                                        />
                                      </label>
                                      <button
                                        type="button"
                                        onClick={() => removeEvidence(idx)}
                                        className="p-1.5 text-muted-foreground hover:text-rose-500 border border-border/40 rounded bg-background/20 mt-4"
                                      >
                                        <Trash2 className="size-3.5" />
                                      </button>
                                    </div>

                                    <label className="text-[9px] font-bold text-muted-foreground">
                                      Comentarios de Evidencia:
                                      <input
                                        type="text"
                                        value={ev.nota}
                                        onChange={(e) => updateEvidence(idx, 'nota', e.target.value)}
                                        className="h-7 w-full rounded border border-input bg-background/50 px-2 text-xs focus:ring-1 focus:ring-cyan-500 focus:outline-none mt-1"
                                      />
                                    </label>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <>
                            {/* Metadata summary */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-border/20 pb-4">
                              <div>
                                <span className="text-[9px] uppercase tracking-wider font-bold text-foreground block">General</span>
                                <p><span className="font-semibold">Servicio:</span> {test.idServicio}</p>
                                <p><span className="font-semibold">Categoría:</span> {test.categoria}</p>
                              </div>
                              <div>
                                <span className="text-[9px] uppercase tracking-wider font-bold text-foreground block">Hallazgo</span>
                                {test.nombreHallazgo ? (
                                  <>
                                    <p className="font-bold text-foreground/95">{test.nombreHallazgo}</p>
                                    <p><span className="font-semibold">CWE:</span> {test.cwe}</p>
                                  </>
                                ) : (
                                  <p className="italic">Sin hallazgos</p>
                                )}
                              </div>
                              <div>
                                <span className="text-[9px] uppercase tracking-wider font-bold text-foreground block">Target</span>
                                <p><span className="font-semibold">Target (Single):</span> <span className="text-cyan-500 font-bold">{test.singleTarget || '—'}</span></p>
                                <p><span className="font-semibold">Targets File (Bulk):</span> <span className="text-indigo-600 dark:text-indigo-400 font-mono">{test.targetsFile || '—'}</span></p>
                              </div>
                            </div>

                            {test.comentariosPrueba && (
                              <div className="p-3 bg-cyan-500/5 border border-cyan-500/10 rounded-xl">
                                <span className="font-bold text-[10px] text-foreground block">Comentarios:</span>
                                <p className="text-foreground leading-relaxed mt-1">{test.comentariosPrueba}</p>
                              </div>
                            )}

                            {/* Commands list */}
                            {(test.comandoSingle || test.comandoBulk) && (
                              <div className="space-y-4 font-mono text-[11px]">
                                <span className="text-[10px] font-sans font-bold uppercase text-foreground block">
                                  Snippets de Consola Dinámicos (Copiables)
                                </span>

                                {test.comandoSingle && (
                                  <div className="space-y-1">
                                    <div className="flex justify-between items-center text-[10px] font-sans text-muted-foreground">
                                      <span>Comando Unitario ({test.singleTarget || 'Sin target'}):</span>
                                      <button
                                        onClick={() =>
                                          copyToClipboard(
                                            substituteCommand(test.comandoSingle, test.singleTarget, test.targetsFile),
                                            `s-${test.id}`
                                          )
                                        }
                                        className="inline-flex items-center gap-1 hover:text-cyan-500 transition-colors bg-background/60 border border-border/40 rounded px-1.5 py-0.5"
                                      >
                                        <Copy className="size-3" />
                                        {copiedId === `s-${test.id}` ? 'Copiado!' : 'Copiar'}
                                      </button>
                                    </div>
                                    <pre className="bg-[#0f141c] text-[#a5b4fc] p-3 rounded-lg overflow-x-auto select-all">
                                      {substituteCommand(test.comandoSingle, test.singleTarget, test.targetsFile)}
                                    </pre>
                                  </div>
                                )}

                                {test.comandoBulk && (
                                  <div className="space-y-1">
                                    <div className="flex justify-between items-center text-[10px] font-sans text-muted-foreground">
                                      <span>Comando Bulk ({test.targetsFile || 'Sin archivo'}):</span>
                                      <button
                                        onClick={() =>
                                          copyToClipboard(
                                            substituteCommand(test.comandoBulk, test.singleTarget, test.targetsFile),
                                            `b-${test.id}`
                                          )
                                        }
                                        className="inline-flex items-center gap-1 hover:text-cyan-500 transition-colors bg-background/60 border border-border/40 rounded px-1.5 py-0.5"
                                      >
                                        <Copy className="size-3" />
                                        {copiedId === `b-${test.id}` ? 'Copiado!' : 'Copiar'}
                                      </button>
                                    </div>
                                    <pre className="bg-[#0f141c] text-[#a5b4fc] p-3 rounded-lg overflow-x-auto select-all">
                                      {substituteCommand(test.comandoBulk, test.singleTarget, test.targetsFile)}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Evidences screenshots */}
                            {test.evidencias.length > 0 && (
                              <div className="space-y-2">
                                <span className="text-[10px] font-bold uppercase text-foreground block">Evidencias Adjuntas</span>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  {test.evidencias.map((ev, idx) => (
                                    <div key={idx} className="p-3 border border-border bg-background/50 rounded-xl flex items-start gap-2.5">
                                      <ImageIcon className="size-4 text-cyan-500 shrink-0 mt-0.5" />
                                      <div className="min-w-0">
                                        <p className="font-mono font-bold text-[10px] text-foreground truncate">{ev.imagen}</p>
                                        <p className="text-muted-foreground text-[11px] mt-1 break-words">{ev.nota || 'Sin comentarios'}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          ) : (
            /* EXCEL MATRIX VIEW GRID COMPRISING ALL 62 COLUMNS - FULL WIDTH & INTERACTIVE */
            <Card className="border-border/40 bg-card dark:bg-[#070b11]/85 backdrop-blur rounded-xl overflow-hidden shadow-2xl w-full border">
              <div className="overflow-x-auto max-w-full relative">
                <table className="w-full text-left border-collapse text-[10px] whitespace-nowrap table-layout-fixed">
                  <thead>
                    <tr className="border-b border-border/30 bg-muted/40 text-[9px] uppercase font-bold text-muted-foreground select-none">
                      {EXCEL_HEADERS.map((h, i) => {
                        const isSorted = sortConfig && sortConfig.key === EXCEL_KEYS[i];

                        return (
                          <th
                            key={i}
                            style={{
                              minWidth: colWidths[i] || 150,
                              width: colWidths[i] || 150,
                            }}
                            className={`p-2.5 border-r border-border/20 relative group transition-colors hover:bg-muted/60 ${
                              i === 1 ? 'sticky left-0 bg-muted dark:bg-[#0f1520] z-20 w-12 text-center text-foreground dark:text-cyan-400/90' : ''
                            } ${i === 0 ? 'w-10 text-center sticky left-0 z-30 bg-background dark:bg-[#0a0f18] border-r-2 border-cyan-500/20' : ''}`}
                          >
                            {i === 0 ? (
                              <button
                                onClick={toggleSelectAll}
                                className="focus:outline-none inline-flex items-center justify-center"
                              >
                                {isAllSelected ? (
                                  <CheckSquare className="size-3.5 text-cyan-500" />
                                ) : (
                                  <Square className="size-3.5 text-muted-foreground" />
                                )}
                              </button>
                            ) : (
                              <div
                                onClick={() => handleSort(i)}
                                className="flex items-center gap-1.5 cursor-pointer justify-between pr-2"
                              >
                                <span className="truncate pr-1 block">{h}</span>
                                {i > 0 && EXCEL_KEYS[i] !== 'id' && (
                                  <span className="text-muted-foreground shrink-0 opacity-40 group-hover:opacity-100 transition-opacity">
                                    {isSorted ? (
                                      sortConfig?.direction === 'asc' ? (
                                        <ChevronUp className="size-3 text-cyan-400" />
                                      ) : (
                                        <ChevronDown className="size-3 text-cyan-400" />
                                      )
                                    ) : (
                                      <ChevronsUpDown className="size-2.5" />
                                    )}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Drag to Resize border handler */}
                            <div
                              onMouseDown={(e) => handleMouseDown(i, e)}
                              className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-cyan-500/60 z-20"
                            />
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20 font-mono">
                    {sortedTests.map((test) => {
                      const isSelected = selectedTestIds.includes(test.id);

                      return (
                        <tr
                          key={test.id}
                          className={`hover:bg-cyan-500/5 transition-all ${
                            isSelected
                              ? 'bg-cyan-600/10'
                              : test.resultadoPrueba === 'FAILED'
                                ? 'bg-rose-500/5'
                                : test.resultadoPrueba === 'PASSED'
                                  ? 'bg-emerald-500/5'
                                  : 'bg-background/10'
                          }`}
                        >
                          {/* 0. Checkbox Column */}
                          <td className="p-2 text-center border-r-2 border-cyan-500/20 sticky left-0 z-30 bg-background dark:bg-[#0a0f18] w-10">
                            <button
                              onClick={() => toggleSelectOne(test.id)}
                              className="focus:outline-none inline-flex items-center justify-center"
                            >
                              {isSelected ? (
                                <CheckSquare className="size-3.5 text-cyan-500" />
                              ) : (
                                <Square className="size-3.5 text-muted-foreground/60" />
                              )}
                            </button>
                          </td>

                          {/* 1. Id (Sticky Left) */}
                          <td className="p-2 text-center font-bold bg-muted dark:bg-[#0f1520] border-r border-border/20 sticky left-0 z-20 w-12 text-foreground dark:text-cyan-400/90 font-mono">
                            {test.id}
                          </td>

                          {/* 2. Id de Servicio */}
                          <td className="p-1 border-r border-border/20">
                            <input
                              type="text"
                              value={test.idServicio}
                              onChange={(e) => handleMatrixCellUpdate(test.id, 'idServicio', e.target.value)}
                              className="w-full h-7 rounded border-none bg-transparent px-1 focus:bg-background/80 focus:ring-1 focus:ring-cyan-500 focus:outline-none text-[10px]"
                            />
                          </td>

                          {/* 3. Plataforma */}
                          <td className="p-1 border-r border-border/20">
                            <input
                              type="text"
                              value={test.plataforma}
                              onChange={(e) => handleMatrixCellUpdate(test.id, 'plataforma', e.target.value)}
                              className="w-full h-7 rounded border-none bg-transparent px-1 focus:bg-background/80 focus:ring-1 focus:ring-cyan-500 focus:outline-none text-[10px]"
                            />
                          </td>

                          {/* 4. Servicio Tecnológico */}
                          <td className="p-1 border-r border-border/20">
                            <input
                              type="text"
                              value={test.servicioTecnologico}
                              onChange={(e) => handleMatrixCellUpdate(test.id, 'servicioTecnologico', e.target.value)}
                              className="w-full h-7 rounded border-none bg-transparent px-1 focus:bg-background/80 focus:ring-1 focus:ring-cyan-500 focus:outline-none text-[10px]"
                            />
                          </td>

                          {/* 5. Id de Prueba de Seguridad */}
                          <td className="p-1 border-r border-border/20 font-bold">
                            <input
                              type="text"
                              value={test.idPruebaSeguridad}
                              onChange={(e) => handleMatrixCellUpdate(test.id, 'idPruebaSeguridad', e.target.value)}
                              className="w-full h-7 rounded border-none bg-transparent px-1 focus:bg-background/80 focus:ring-1 focus:ring-cyan-500 focus:outline-none font-bold text-foreground"
                            />
                          </td>

                          {/* 6. Evaluación Asociada */}
                          <td className="p-1 border-r border-border/20">
                            <input
                              type="text"
                              value={test.evaluacionAsociada}
                              onChange={(e) => handleMatrixCellUpdate(test.id, 'evaluacionAsociada', e.target.value)}
                              className="w-full h-7 rounded border-none bg-transparent px-1 focus:bg-background/80"
                            />
                          </td>

                          {/* 7. Categoria */}
                          <td className="p-1 border-r border-border/20">
                            <input
                              type="text"
                              value={test.categoria}
                              onChange={(e) => handleMatrixCellUpdate(test.id, 'categoria', e.target.value)}
                              className="w-full h-7 rounded border-none bg-transparent px-1 focus:bg-background/80"
                            />
                          </td>

                          {/* 8. Nombre de la Prueba */}
                          <td className="p-1 border-r border-border/20">
                            <input
                              type="text"
                              value={test.nombrePrueba}
                              onChange={(e) => handleMatrixCellUpdate(test.id, 'nombrePrueba', e.target.value)}
                              className="w-full h-7 rounded border-none bg-transparent px-1 focus:bg-background/80 font-semibold font-sans text-foreground"
                            />
                          </td>

                          {/* 9. Resultado / Estado */}
                          <td className="p-1 border-r border-border/20">
                            <select
                              value={test.resultadoPrueba}
                              onChange={(e) => handleMatrixCellUpdate(test.id, 'resultadoPrueba', e.target.value)}
                              className={`w-full h-7 rounded border border-border/40 bg-background/50 px-1 text-[10px] font-bold focus:ring-1 focus:ring-cyan-500 focus:outline-none ${
                                test.resultadoPrueba === 'FAILED'
                                  ? 'text-rose-500'
                                  : test.resultadoPrueba === 'PASSED'
                                    ? 'text-emerald-500'
                                    : 'text-muted-foreground'
                              }`}
                            >
                              <option value="PENDING">PENDING</option>
                              <option value="PASSED">PASSED</option>
                              <option value="FAILED">FAILED</option>
                              <option value="Out Of Scope">Out Of Scope</option>
                            </select>
                          </td>

                          {/* 10. Comentarios de la Prueba */}
                          <td className="p-1 border-r border-border/20">
                            <input
                              type="text"
                              value={test.comentariosPrueba || ''}
                              onChange={(e) => handleMatrixCellUpdate(test.id, 'comentariosPrueba', e.target.value)}
                              className="w-full h-7 rounded border-none bg-transparent px-1 focus:bg-background/80 font-sans"
                            />
                          </td>

                          {/* 11. Clasificación */}
                          <td className="p-1 border-r border-border/20">
                            <input
                              type="text"
                              value={test.clasificacion || ''}
                              onChange={(e) => handleMatrixCellUpdate(test.id, 'clasificacion', e.target.value)}
                              className="w-full h-7 rounded border-none bg-transparent px-1"
                            />
                          </td>

                          {/* 12. Nombre de Hallazgo */}
                          <td className="p-1 border-r border-border/20">
                            <input
                              type="text"
                              value={test.nombreHallazgo || ''}
                              onChange={(e) => handleMatrixCellUpdate(test.id, 'nombreHallazgo', e.target.value)}
                              className="w-full h-7 rounded border-none bg-transparent px-1 focus:bg-background/80 font-semibold font-sans text-foreground"
                            />
                          </td>

                          {/* 13. Descripción de la Prueba */}
                          <td className="p-1 border-r border-border/20">
                            <input
                              type="text"
                              value={test.descripcionPrueba}
                              onChange={(e) => handleMatrixCellUpdate(test.id, 'descripcionPrueba', e.target.value)}
                              className="w-full h-7 rounded border-none bg-transparent px-1 focus:bg-background/80 font-sans"
                            />
                          </td>

                          {/* 14. Single Target */}
                          <td className="p-1 border-r border-border/20">
                            <input
                              type="text"
                              value={test.singleTarget || ''}
                              onChange={(e) => handleMatrixCellUpdate(test.id, 'singleTarget', e.target.value)}
                              className="w-full h-7 rounded border-none bg-transparent px-1 focus:bg-background/80 text-cyan-600 dark:text-cyan-400 font-bold"
                            />
                          </td>

                          {/* 15. Prueba con Comando de Terminal Sugerido Para Bulk Targets */}
                          <td className="p-1 border-r border-border/20">
                            <div className="flex items-center gap-1.5 bg-muted dark:bg-[#0a0f16]/95 px-2 py-1 rounded border border-border/20 max-w-full">
                              <input
                                type="text"
                                value={substituteCommand(test.comandoBulk, test.singleTarget, test.targetsFile)}
                                onChange={(e) => handleMatrixCellUpdate(test.id, 'comandoBulk', e.target.value)}
                                className="font-mono text-[9px] text-indigo-600 dark:text-[#a5b4fc] bg-transparent border-none outline-none grow min-w-0"
                              />
                              {test.comandoBulk && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    copyToClipboard(
                                      substituteCommand(test.comandoBulk, test.singleTarget, test.targetsFile),
                                      `matrix-b-${test.id}`
                                    )
                                  }
                                  className="shrink-0 p-1 text-muted-foreground hover:text-cyan-400 rounded bg-background/80 border border-border/40 transition-colors"
                                  title="Copiar Comando Bulk"
                                >
                                  {copiedId === `matrix-b-${test.id}` ? (
                                    <Check className="size-3 text-emerald-500" />
                                  ) : (
                                    <Copy className="size-3" />
                                  )}
                                </button>
                              )}
                            </div>
                          </td>

                          {/* 16. Targets File */}
                          <td className="p-1 border-r border-border/20">
                            <input
                              type="text"
                              value={test.targetsFile || ''}
                              onChange={(e) => handleMatrixCellUpdate(test.id, 'targetsFile', e.target.value)}
                              className="w-full h-7 rounded border-none bg-transparent px-1 focus:bg-background/80 text-indigo-600 dark:text-indigo-400"
                            />
                          </td>

                          {/* 17. Prueba con Comando de Terminal Sugerido Para Single Target */}
                          <td className="p-1 border-r border-border/20">
                            <div className="flex items-center gap-1.5 bg-muted dark:bg-[#0a0f16]/95 px-2 py-1 rounded border border-border/20 max-w-full">
                              <input
                                type="text"
                                value={substituteCommand(test.comandoSingle, test.singleTarget, test.targetsFile)}
                                onChange={(e) => handleMatrixCellUpdate(test.id, 'comandoSingle', e.target.value)}
                                className="font-mono text-[9px] text-indigo-600 dark:text-[#a5b4fc] bg-transparent border-none outline-none grow min-w-0"
                              />
                              {test.comandoSingle && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    copyToClipboard(
                                      substituteCommand(test.comandoSingle, test.singleTarget, test.targetsFile),
                                      `matrix-s-${test.id}`
                                    )
                                  }
                                  className="shrink-0 p-1 text-muted-foreground hover:text-cyan-400 rounded bg-background/80 border border-border/40 transition-colors"
                                  title="Copiar Comando Single Target"
                                >
                                  {copiedId === `matrix-s-${test.id}` ? (
                                    <Check className="size-3 text-emerald-500" />
                                  ) : (
                                    <Copy className="size-3" />
                                  )}
                                </button>
                              )}
                            </div>
                          </td>

                          {/* 18. Verificación con Filtro de BurpSuite HTTP History Sugerido */}
                          <td className="p-1 border-r border-border/20">
                            <input
                              type="text"
                              value={test.filtroBurpHistory || ''}
                              onChange={(e) => handleMatrixCellUpdate(test.id, 'filtroBurpHistory', e.target.value)}
                              className="w-full h-7 rounded border-none bg-transparent px-1 focus:bg-background/80"
                            />
                          </td>

                          {/* 19. Verificación con Filtro de BurpSuite Search Sugerido */}
                          <td className="p-1 border-r border-border/20">
                            <input
                              type="text"
                              value={test.filtroBurpSearch || ''}
                              onChange={(e) => handleMatrixCellUpdate(test.id, 'filtroBurpSearch', e.target.value)}
                              className="w-full h-7 rounded border-none bg-transparent px-1 focus:bg-background/80"
                            />
                          </td>

                          {/* 20. BurpSuite File */}
                          <td className="p-1 border-r border-border/20">
                            <input
                              type="text"
                              value={test.burpSuiteFile || ''}
                              onChange={(e) => handleMatrixCellUpdate(test.id, 'burpSuiteFile', e.target.value)}
                              className="w-full h-7 rounded border-none bg-transparent px-1 focus:bg-background/80"
                            />
                          </td>

                          {/* 21. Verificación con Comándo de Terminal Sugerido Para BurpSuite File */}
                          <td className="p-1 border-r border-border/20">
                            <input
                              type="text"
                              value={test.comandoBurpFile || ''}
                              onChange={(e) => handleMatrixCellUpdate(test.id, 'comandoBurpFile', e.target.value)}
                              className="w-full h-7 rounded border-none bg-transparent px-1"
                            />
                          </td>

                          {/* 22. Verificación con Snippet de Consola de Desarrollador en Navegador con Archivo HAR */}
                          <td className="p-1 border-r border-border/20">
                            <input
                              type="text"
                              value={test.snippetDeveloperConsole || ''}
                              onChange={(e) => handleMatrixCellUpdate(test.id, 'snippetDeveloperConsole', e.target.value)}
                              className="w-full h-7 rounded border-none bg-transparent px-1"
                            />
                          </td>

                          {/* 23-34. Evidencias [1-6] Imagen y Nota */}
                          {[0, 1, 2, 3, 4, 5].map((idx) => (
                            <React.Fragment key={idx}>
                              <td className="p-1 border-r border-border/20">
                                <input
                                  type="text"
                                  placeholder={`Evidencia ${idx + 1}.png`}
                                  value={test.evidencias[idx]?.imagen || ''}
                                  onChange={(e) => handleMatrixEvidenceUpdate(test.id, idx, 'imagen', e.target.value)}
                                  className="w-full h-7 rounded border-none bg-transparent px-1"
                                />
                              </td>
                              <td className="p-1 border-r border-border/20">
                                <input
                                  type="text"
                                  placeholder={`Nota ${idx + 1}`}
                                  value={test.evidencias[idx]?.nota || ''}
                                  onChange={(e) => handleMatrixEvidenceUpdate(test.id, idx, 'nota', e.target.value)}
                                  className="w-full h-7 rounded border-none bg-transparent px-1"
                                />
                              </td>
                            </React.Fragment>
                          ))}

                          {/* 35. Herramienta Sugerida */}
                          <td className="p-1 border-r border-border/20">
                            <input
                              type="text"
                              value={test.herramientaSugerida || ''}
                              onChange={(e) => handleMatrixCellUpdate(test.id, 'herramientaSugerida', e.target.value)}
                              className="w-full h-7 rounded border-none bg-transparent px-1"
                            />
                          </td>

                          {/* 36. Herramienta que Incluye la Prueba */}
                          <td className="p-1 border-r border-border/20">
                            <input
                              type="text"
                              value={test.herramientaIncluyePrueba || ''}
                              onChange={(e) => handleMatrixCellUpdate(test.id, 'herramientaIncluyePrueba', e.target.value)}
                              className="w-full h-7 rounded border-none bg-transparent px-1"
                            />
                          </td>

                          {/* 37. Referencias */}
                          <td className="p-1 border-r border-border/20">
                            <input
                              type="text"
                              value={test.referencias || ''}
                              onChange={(e) => handleMatrixCellUpdate(test.id, 'referencias', e.target.value)}
                              className="w-full h-7 rounded border-none bg-transparent px-1"
                            />
                          </td>

                          {/* 38. Táctica MITRE */}
                          <td className="p-1 border-r border-border/20">
                            <input
                              type="text"
                              value={test.mitreTactica || ''}
                              onChange={(e) => handleMatrixCellUpdate(test.id, 'mitreTactica', e.target.value)}
                              className="w-full h-7 rounded border-none bg-transparent px-1"
                            />
                          </td>

                          {/* 39. Técnica MITRE */}
                          <td className="p-1 border-r border-border/20">
                            <input
                              type="text"
                              value={test.mitreTecnica || ''}
                              onChange={(e) => handleMatrixCellUpdate(test.id, 'mitreTecnica', e.target.value)}
                              className="w-full h-7 rounded border-none bg-transparent px-1"
                            />
                          </td>

                          {/* 40. ID MITRE */}
                          <td className="p-1 border-r border-border/20">
                            <input
                              type="text"
                              value={test.mitreId || ''}
                              onChange={(e) => handleMatrixCellUpdate(test.id, 'mitreId', e.target.value)}
                              className="w-full h-7 rounded border-none bg-transparent px-1"
                            />
                          </td>

                          {/* 41. Folio2 */}
                          <td className="p-1 border-r border-border/20">
                            <input
                              type="text"
                              value={test.folio2 || ''}
                              onChange={(e) => handleMatrixCellUpdate(test.id, 'folio2', e.target.value)}
                              className="w-full h-7 rounded border-none bg-transparent px-1"
                            />
                          </td>

                          {/* 42. Fecha de detección */}
                          <td className="p-1 border-r border-border/20">
                            <input
                              type="text"
                              value={test.fechaDeteccion || ''}
                              onChange={(e) => handleMatrixCellUpdate(test.id, 'fechaDeteccion', e.target.value)}
                              className="w-full h-7 rounded border-none bg-transparent px-1"
                            />
                          </td>

                          {/* 43. Nombre de activo tecnológico */}
                          <td className="p-1 border-r border-border/20">
                            <input
                              type="text"
                              value={test.nombreActivoTecnologico || ''}
                              onChange={(e) => handleMatrixCellUpdate(test.id, 'nombreActivoTecnologico', e.target.value)}
                              className="w-full h-7 rounded border-none bg-transparent px-1"
                            />
                          </td>

                          {/* 44. Servicio de seguridad asociado */}
                          <td className="p-1 border-r border-border/20">
                            <input
                              type="text"
                              value={test.servicioSeguridadAsociado || ''}
                              onChange={(e) => handleMatrixCellUpdate(test.id, 'servicioSeguridadAsociado', e.target.value)}
                              className="w-full h-7 rounded border-none bg-transparent px-1"
                            />
                          </td>

                          {/* 45. Tipo de revisión */}
                          <td className="p-1 border-r border-border/20">
                            <input
                              type="text"
                              value={test.tipoRevision || ''}
                              onChange={(e) => handleMatrixCellUpdate(test.id, 'tipoRevision', e.target.value)}
                              className="w-full h-7 rounded border-none bg-transparent px-1"
                            />
                          </td>

                          {/* 46. Activo objetivo de prueba de seguridad */}
                          <td className="p-1 border-r border-border/20">
                            <input
                              type="text"
                              value={test.activoObjetivoPruebaSeguridad || ''}
                              onChange={(e) => handleMatrixCellUpdate(test.id, 'activoObjetivoPruebaSeguridad', e.target.value)}
                              className="w-full h-7 rounded border-none bg-transparent px-1"
                            />
                          </td>

                          {/* 47. Nombre de prueba seguridad */}
                          <td className="p-1 border-r border-border/20">
                            <input
                              type="text"
                              value={test.nombrePruebaSeguridad || ''}
                              onChange={(e) => handleMatrixCellUpdate(test.id, 'nombrePruebaSeguridad', e.target.value)}
                              className="w-full h-7 rounded border-none bg-transparent px-1"
                            />
                          </td>

                          {/* 48. Descripción de la prueba de seguridad */}
                          <td className="p-1 border-r border-border/20">
                            <input
                              type="text"
                              value={test.descripcionPruebaSeguridad || ''}
                              onChange={(e) => handleMatrixCellUpdate(test.id, 'descripcionPruebaSeguridad', e.target.value)}
                              className="w-full h-7 rounded border-none bg-transparent px-1"
                            />
                          </td>

                          {/* 49. Resultado de la prueba2 */}
                          <td className="p-1 border-r border-border/20">
                            <input
                              type="text"
                              value={test.resultadoPrueba2 || ''}
                              onChange={(e) => handleMatrixCellUpdate(test.id, 'resultadoPrueba2', e.target.value)}
                              className="w-full h-7 rounded border-none bg-transparent px-1"
                            />
                          </td>

                          {/* 50. Evidencia principal */}
                          <td className="p-1 border-r border-border/20">
                            <input
                              type="text"
                              value={test.evidenciaPrincipal || ''}
                              onChange={(e) => handleMatrixCellUpdate(test.id, 'evidenciaPrincipal', e.target.value)}
                              className="w-full h-7 rounded border-none bg-transparent px-1"
                            />
                          </td>

                          {/* 51. Notas de la prueba de seguridad */}
                          <td className="p-1 border-r border-border/20">
                            <input
                              type="text"
                              value={test.notasPruebaSeguridad || ''}
                              onChange={(e) => handleMatrixCellUpdate(test.id, 'notasPruebaSeguridad', e.target.value)}
                              className="w-full h-7 rounded border-none bg-transparent px-1"
                            />
                          </td>

                          {/* 52. Evidencia complementaria 1 */}
                          <td className="p-1 border-r border-border/20">
                            <input
                              type="text"
                              value={test.evidenciaComplementaria1 || ''}
                              onChange={(e) => handleMatrixCellUpdate(test.id, 'evidenciaComplementaria1', e.target.value)}
                              className="w-full h-7 rounded border-none bg-transparent px-1"
                            />
                          </td>

                          {/* 53. Evidencia complementaria 2 */}
                          <td className="p-1 border-r border-border/20">
                            <input
                              type="text"
                              value={test.evidenciaComplementaria2 || ''}
                              onChange={(e) => handleMatrixCellUpdate(test.id, 'evidenciaComplementaria2', e.target.value)}
                              className="w-full h-7 rounded border-none bg-transparent px-1"
                            />
                          </td>

                          {/* 54. Evidencia complementaria 3 */}
                          <td className="p-1 border-r border-border/20">
                            <input
                              type="text"
                              value={test.evidenciaComplementaria3 || ''}
                              onChange={(e) => handleMatrixCellUpdate(test.id, 'evidenciaComplementaria3', e.target.value)}
                              className="w-full h-7 rounded border-none bg-transparent px-1"
                            />
                          </td>

                          {/* 55. Descripción */}
                          <td className="p-1 border-r border-border/20">
                            <input
                              type="text"
                              value={test.descripcion || ''}
                              onChange={(e) => handleMatrixCellUpdate(test.id, 'descripcion', e.target.value)}
                              className="w-full h-7 rounded border-none bg-transparent px-1"
                            />
                          </td>

                          {/* 56. Amenaza */}
                          <td className="p-1 border-r border-border/20">
                            <input
                              type="text"
                              value={test.amenaza || ''}
                              onChange={(e) => handleMatrixCellUpdate(test.id, 'amenaza', e.target.value)}
                              className="w-full h-7 rounded border-none bg-transparent px-1 font-sans"
                            />
                          </td>

                          {/* 57. Recomendaciones */}
                          <td className="p-1 border-r border-border/20">
                            <input
                              type="text"
                              value={test.recomendaciones || ''}
                              onChange={(e) => handleMatrixCellUpdate(test.id, 'recomendaciones', e.target.value)}
                              className="w-full h-7 rounded border-none bg-transparent px-1 font-sans"
                            />
                          </td>

                          {/* 58. Prueba de Concepto */}
                          <td className="p-1 border-r border-border/20">
                            <input
                              type="text"
                              value={test.poc || ''}
                              onChange={(e) => handleMatrixCellUpdate(test.id, 'poc', e.target.value)}
                              className="w-full h-7 rounded border-none bg-transparent px-1 font-sans"
                            />
                          </td>

                          {/* 59. CWE */}
                          <td className="p-1 border-r border-border/20 font-bold">
                            <input
                              type="text"
                              value={test.cwe || ''}
                              onChange={(e) => handleMatrixCellUpdate(test.id, 'cwe', e.target.value)}
                              className="w-full h-7 rounded border-none bg-transparent px-1 font-bold"
                            />
                          </td>

                          {/* 60. FQDN */}
                          <td className="p-1 border-r border-border/20">
                            <input
                              type="text"
                              value={test.fqdn || ''}
                              onChange={(e) => handleMatrixCellUpdate(test.id, 'fqdn', e.target.value)}
                              className="w-full h-7 rounded border-none bg-transparent px-1 text-cyan-600 dark:text-cyan-400"
                            />
                          </td>

                          {/* 61. Ambiente */}
                          <td className="p-1 border-r border-border/20">
                            <input
                              type="text"
                              value={test.ambiente || ''}
                              onChange={(e) => handleMatrixCellUpdate(test.id, 'ambiente', e.target.value)}
                              className="w-full h-7 rounded border-none bg-transparent px-1"
                            />
                          </td>

                          {/* 62. CVSS Score */}
                          <td className="p-1 border-r border-border/20">
                            <input
                              type="number"
                              step="0.1"
                              value={test.cvssScore || 0}
                              onChange={(e) => handleMatrixCellUpdate(test.id, 'cvssScore', parseFloat(e.target.value) || 0)}
                              className="w-full h-7 rounded border-none bg-transparent px-1 text-center font-bold text-rose-400"
                            />
                          </td>

                          {/* 63. CVSS Vector */}
                          <td className="p-1 border-r border-border/20">
                            <input
                              type="text"
                              value={test.cvssVector || ''}
                              onChange={(e) => handleMatrixCellUpdate(test.id, 'cvssVector', e.target.value)}
                              className="w-full h-7 rounded border-none bg-transparent px-1 text-muted-foreground font-light text-[9px]"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* Footer stats */}
              <div className="p-3 bg-muted/20 border-t border-border/40 text-[9px] text-muted-foreground flex justify-between font-mono">
                <span>Excel Matrix - 62 Columnas técnicas redimensionables e interactivas en tiempo real</span>
                <span className="font-semibold text-cyan-600 dark:text-cyan-400">
                  {sortedTests.filter((t) => t.resultadoPrueba !== 'PENDING').length} / {sortedTests.length} pruebas gestionadas
                </span>
              </div>
            </Card>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-center border border-dashed border-border rounded-xl p-12 text-muted-foreground italic text-xs w-full">
          Selecciona una suite de pruebas para cargar sus casos activos.
        </div>
      )}

      {/* Creation Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-md border-border bg-card/90 shadow-2xl rounded-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <CardHeader className="border-b border-border/40 pb-4">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Shield className="size-5 text-cyan-500" />
                Nueva Suite de Pruebas de Seguridad
              </CardTitle>
              <CardDescription className="text-xs">
                Crea una instancia para documentar casos de prueba ofensivos de un proyecto.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleCreateSuite}>
              <CardContent className="space-y-4 p-5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Nombre de la Suite:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Pentest WSTG Portal Web"
                    value={newSuiteName}
                    onChange={(e) => setNewSuiteName(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-input bg-background/50 text-xs focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Proyecto / Servicio de Seguridad:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Digital Banking Platform (EIM 9847)"
                    value={newSuiteProject}
                    onChange={(e) => setNewSuiteProject(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-input bg-background/50 text-xs focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                  />
                </div>
              </CardContent>
              <div className="p-4 border-t border-border/40 bg-muted/20 flex justify-end gap-2 text-xs">
                <Button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="bg-transparent hover:bg-muted text-muted-foreground font-semibold px-4 py-2 border border-border/40 rounded-lg h-9"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="bg-cyan-600 hover:bg-cyan-700 text-white font-semibold px-4 py-2 rounded-lg h-9"
                >
                  Crear Suite
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
