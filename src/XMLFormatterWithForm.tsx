import { useState, useEffect, useMemo, useRef } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { xml } from "@codemirror/lang-xml";
import { json } from "@codemirror/lang-json";
import { oneDark } from "@codemirror/theme-one-dark";
import { githubLight } from "@uiw/codemirror-theme-github";
import { EditorView } from "@codemirror/view";
import { searchKeymap } from "@codemirror/search";
import { keymap } from "@codemirror/view";
import xmlFormatter from "xml-formatter";
import { XMLParser, XMLValidator, XMLBuilder } from "fast-xml-parser";

export default function ProXMLEditor() {
  const [xmlContent, setXmlContent] = useState(`<?xml version="1.0" encoding="UTF-8"?>
<Invoice>
  <Header>
    <InvoiceNumber>F2025-001</InvoiceNumber>
    <Date>2025-11-01</Date>
    <Client>
      <Name>Entreprise Alpha</Name>
    </Client>
  </Header>
  <Items>
    <Item>
      <Description>Prestation développement</Description>
      <Quantity>10</Quantity>
      <UnitPrice>50</UnitPrice>
    </Item>
  </Items>
</Invoice>`);

  const [feedback, setFeedback] = useState<{ message: string; type: "success" | "error" | null }>({
    message: "",
    type: null,
  });

  const [darkMode, setDarkMode] = useState(true);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [jsonContent, setJsonContent] = useState<string>("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const isUpdatingFromXml = useRef(false);
  const isUpdatingFromJson = useRef(false);

  useEffect(() => {
    if (isUpdatingFromJson.current) {
      return;
    }

    if (!xmlContent.trim()) {
      setValidationError(null);
      setJsonContent("");
      setJsonError(null);
      return;
    }

    try {
      const validationOptions = {
        allowBooleanAttributes: true,
        ignoreAttributes: false,
      };
      
      const validationResult = XMLValidator.validate(xmlContent, validationOptions);
      if (validationResult === true) {
        setValidationError(null);
        const parser = new XMLParser({
          ignoreAttributes: false,
          attributeNamePrefix: "@_",
          textNodeName: "#text",
          parseAttributeValue: false,
          trimValues: true,
          parseTagValue: false,
        });
        
        try {
          isUpdatingFromXml.current = true;
          const jsonObj = parser.parse(xmlContent);
          const jsonString = JSON.stringify(jsonObj, null, 2);
          setJsonContent(jsonString);
          setJsonError(null);
        } catch (parseError) {
          setValidationError(
            parseError instanceof Error 
              ? `Erreur de parsing: ${parseError.message}` 
              : "Erreur lors de la conversion XML vers JSON"
          );
          setJsonContent("");
          setJsonError("Erreur de conversion XML -> JSON");
        } finally {
          isUpdatingFromXml.current = false;
        }
      } else {
        const errorDetails = validationResult.err;
        let errorMessage = "Erreur de validation XML";
        
        if (errorDetails) {
          if (errorDetails.msg) {
            errorMessage = errorDetails.msg;
            
            if (errorMessage.includes("char '&' is not expected")) {
              errorMessage += "\n\n💡 Suggestion: Le caractère '&' doit être échappé comme '&amp;' en XML.\n";
              errorMessage += "Exemple: 'Air & Ocean' → 'Air &amp; Ocean'";
              if (errorDetails.line) {
                errorMessage += `\n📍 Ligne ${errorDetails.line}`;
                if (errorDetails.col) {
                  errorMessage += `, colonne ${errorDetails.col}`;
                }
              }
            } else if (errorDetails.line) {
              errorMessage += `\n📍 Ligne ${errorDetails.line}`;
              if (errorDetails.col) {
                errorMessage += `, colonne ${errorDetails.col}`;
              }
            }
          } else {
            if (errorDetails.line) {
              errorMessage += `\n📍 Ligne ${errorDetails.line}`;
              if (errorDetails.col) {
                errorMessage += `, colonne ${errorDetails.col}`;
              }
            }
          }
          if (errorDetails.code && !errorMessage.includes("[Code:")) {
            errorMessage += `\n[Code: ${errorDetails.code}]`;
          }
        }
        
        setValidationError(errorMessage);
        setJsonContent("");
        setJsonError("XML invalide");
      }
    } catch (error) {
      let errorMessage = "Erreur inattendue lors de la validation";
      if (error instanceof Error) {
        errorMessage = error.message;
        if (error.message.includes("Invalid") || error.message.includes("Unexpected")) {
          errorMessage = `Erreur de syntaxe XML: ${error.message}`;
        }
      }
      setValidationError(errorMessage);
      setJsonContent("");
      setJsonError("Erreur de validation XML");
    }
  }, [xmlContent]);

  useEffect(() => {
    if (isUpdatingFromXml.current) {
      return;
    }

    if (!jsonContent.trim()) {
      setJsonError(null);
      return;
    }

    try {
      const jsonObj = JSON.parse(jsonContent);
      setJsonError(null);

      const builder = new XMLBuilder({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
        textNodeName: "#text",
        format: true,
        indentBy: "    ",
        suppressEmptyNode: false,
      });

      try {
        isUpdatingFromJson.current = true;
        const xmlString = builder.build(jsonObj);
        
        const formatted = xmlFormatter(xmlString, {
          indentation: "    ",
          collapseContent: true,
          lineSeparator: "\n",
        });
        
        setXmlContent(formatted);
        setValidationError(null);
      } catch (buildError) {
        setJsonError(
          buildError instanceof Error 
            ? `Erreur de conversion JSON -> XML: ${buildError.message}` 
            : "Erreur lors de la conversion JSON vers XML"
        );
      } finally {
        setTimeout(() => {
          isUpdatingFromJson.current = false;
        }, 100);
      }
    } catch (error) {
      if (error instanceof SyntaxError) {
        setJsonError(`JSON invalide: ${error.message}`);
      } else {
        setJsonError("Erreur lors du parsing JSON");
      }
    }
  }, [jsonContent]);

  const xmlExtensions = useMemo(() => {
    return [
      xml(),
      EditorView.lineWrapping,
      keymap.of(searchKeymap),
      EditorView.theme({
        '.cm-content': {
          padding: '12px',
          fontSize: '13px',
          lineHeight: '1.6',
          fontFamily: '"Fira Code", "Consolas", "Monaco", "Courier New", monospace',
        },
        '.cm-gutter': {
          fontSize: '13px',
          minWidth: '50px',
        },
        '.cm-lineNumbers .cm-gutterElement': {
          minWidth: '3em',
          padding: '0 10px 0 6px',
          fontSize: '13px',
        },
        '.cm-line': {
          padding: '0 3px',
        },
      }),
    ];
  }, []);

  const jsonExtensions = useMemo(() => {
    return [
      json(),
      EditorView.lineWrapping,
      keymap.of(searchKeymap),
      EditorView.theme({
        '.cm-content': {
          padding: '12px',
          fontSize: '13px',
          lineHeight: '1.6',
          fontFamily: '"Fira Code", "Consolas", "Monaco", "Courier New", monospace',
        },
        '.cm-gutter': {
          fontSize: '13px',
          minWidth: '50px',
        },
        '.cm-lineNumbers .cm-gutterElement': {
          minWidth: '3em',
          padding: '0 10px 0 6px',
          fontSize: '13px',
        },
        '.cm-line': {
          padding: '0 3px',
        },
      }),
    ];
  }, []);

  const showFeedback = (message: string, type: "success" | "error") => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback({ message: "", type: null }), 2000);
  };

  const formatXml = () => {
    try {
      const formatted = xmlFormatter(xmlContent, {
        indentation: "    ",
        collapseContent: true,
        lineSeparator: "\n",
      });
      setXmlContent(formatted);
      showFeedback("XML formaté avec succès !", "success");
    } catch {
      showFeedback("Erreur de format XML !", "error");
    }
  };

  const downloadXml = () => {
    const blob = new Blob([xmlContent], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "invoice.xml";
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyXml = () => {
    navigator.clipboard.writeText(xmlContent);
    showFeedback("XML copié dans le presse-papier !", "success");
  };

  return (
    <div className={`${darkMode ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-900"} flex h-screen`}>
      {/* Barre latérale */}
      <div className={`${darkMode ? "bg-gray-800" : "bg-white"} w-60 p-4 flex flex-col gap-3 border-r ${darkMode ? "border-gray-700" : "border-gray-300"}`}>
        <h2 className="text-lg font-semibold mb-2">XML Formatter</h2>

        {/* Recherche */}
        <div className="mb-2">
          <div className={`p-2 rounded text-xs ${darkMode ? "bg-gray-700 text-gray-300" : "bg-gray-200 text-gray-700"}`}>
            <strong>🔍 Recherche:</strong>
            <p className="mt-1 text-xs">
              Appuyez sur <kbd className={`px-1.5 py-0.5 rounded text-xs font-mono ${darkMode ? "bg-gray-600 text-white" : "bg-gray-300 text-gray-800"}`}>Ctrl+F</kbd> ou <kbd className={`px-1.5 py-0.5 rounded text-xs font-mono ${darkMode ? "bg-gray-600 text-white" : "bg-gray-300 text-gray-800"}`}>Cmd+F</kbd> pour rechercher et surligner dans le XML
            </p>
          </div>
        </div>

        <button
          onClick={formatXml}
          className={`${darkMode ? "bg-gray-700 hover:bg-gray-600" : "bg-gray-200 hover:bg-gray-300"} w-full px-3 py-2 rounded transition`}
        >
          Formater
        </button>
        <button
          onClick={downloadXml}
          className={`${darkMode ? "bg-green-700 hover:bg-green-600" : "bg-green-200 hover:bg-green-300"} w-full px-3 py-2 rounded transition`}
        >
          Télécharger
        </button>
        <button
          onClick={copyXml}
          className={`${darkMode ? "bg-blue-700 hover:bg-blue-600" : "bg-blue-200 hover:bg-blue-300"} w-full px-3 py-2 rounded transition`}
        >
          Copier
        </button>

        {/* Toggle sombre / clair */}
        <div className="mt-4 flex items-center gap-2">
          <span className="text-sm">Mode sombre</span>
          <input
            type="checkbox"
            checked={darkMode}
            onChange={() => setDarkMode((prev) => !prev)}
            className="toggle-checkbox"
          />
        </div>

        {/* Validation XML */}
        <div className="mt-4">
          <h3 className="text-sm font-semibold mb-2">Validation XML</h3>
          {validationError ? (
            <div className={`p-2 rounded text-xs ${darkMode ? "bg-red-900 text-red-200" : "bg-red-100 text-red-800"} max-h-32 overflow-y-auto`}>
              <strong>Erreur:</strong>
              <div className="mt-1 break-words whitespace-pre-wrap">{validationError}</div>
            </div>
          ) : xmlContent.trim() ? (
            <div className={`p-2 rounded text-xs ${darkMode ? "bg-green-900 text-green-200" : "bg-green-100 text-green-800"}`}>
              ✓ XML valide
            </div>
          ) : (
            <div className={`p-2 rounded text-xs ${darkMode ? "bg-gray-700 text-gray-400" : "bg-gray-200 text-gray-600"}`}>
              En attente...
            </div>
          )}
        </div>

        {/* Validation JSON */}
        <div className="mt-4">
          <h3 className="text-sm font-semibold mb-2">Validation JSON</h3>
          {jsonError ? (
            <div className={`p-2 rounded text-xs ${darkMode ? "bg-red-900 text-red-200" : "bg-red-100 text-red-800"} max-h-32 overflow-y-auto`}>
              <strong>Erreur:</strong>
              <div className="mt-1 break-words whitespace-pre-wrap">{jsonError}</div>
            </div>
          ) : jsonContent.trim() ? (
            <div className={`p-2 rounded text-xs ${darkMode ? "bg-green-900 text-green-200" : "bg-green-100 text-green-800"}`}>
              ✓ JSON valide
            </div>
          ) : (
            <div className={`p-2 rounded text-xs ${darkMode ? "bg-gray-700 text-gray-400" : "bg-gray-200 text-gray-600"}`}>
              En attente...
            </div>
          )}
        </div>

        {/* Feedback */}
        {feedback.message && (
          <div
            className={`mt-2 p-2 rounded text-sm ${
              feedback.type === "success"
                ? darkMode 
                  ? "bg-green-900 text-green-200 animate-pulse"
                  : "bg-green-100 text-green-800 animate-pulse"
                : darkMode
                  ? "bg-red-900 text-red-200 animate-pulse"
                  : "bg-red-100 text-red-800 animate-pulse"
            }`}
          >
            {feedback.message}
          </div>
        )}
      </div>

      {/* Zone principale : Éditeur XML et Aperçu JSON (vertical) */}
      <div className="flex-1 flex flex-col min-h-0 w-full">
        {/* Éditeur XML */}
        <div className={`flex-1 flex flex-col min-h-0 border-b ${darkMode ? 'border-gray-700' : 'border-gray-300'} editor-container`} style={{ minHeight: '50%' }}>
          <div className={`p-2 border-b flex-shrink-0 ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-300 bg-gray-50'}`}>
            <h3 className="text-sm font-semibold">Éditeur XML</h3>
          </div>
          <div className={`flex-1 min-h-0 ${darkMode ? 'bg-gray-900' : 'bg-white'} codemirror-wrapper`}>
            <CodeMirror
              value={xmlContent}
              theme={darkMode ? oneDark : githubLight}
              extensions={xmlExtensions}
              onChange={(value) => setXmlContent(value)}
              basicSetup={{
                lineNumbers: true,
                foldGutter: true,
                dropCursor: false,
                allowMultipleSelections: false,
              }}
            />
          </div>
        </div>

        {/* Éditeur JSON */}
        <div className="flex-1 flex flex-col min-h-0 json-container" style={{ minHeight: '50%' }}>
          <div className={`p-2 border-b flex-shrink-0 ${darkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-300 bg-gray-50'} flex items-center justify-between`}>
            <h3 className="text-sm font-semibold">Éditeur JSON</h3>
            {jsonError && (
              <span className={`text-xs ${darkMode ? 'text-red-400' : 'text-red-600'}`}>
                ⚠️ {jsonError}
              </span>
            )}
          </div>
          <div className={`flex-1 min-h-0 ${darkMode ? 'bg-gray-900' : 'bg-white'} codemirror-wrapper`}>
            <CodeMirror
              value={jsonContent}
              theme={darkMode ? oneDark : githubLight}
              extensions={jsonExtensions}
              onChange={(value) => setJsonContent(value)}
              basicSetup={{
                lineNumbers: true,
                foldGutter: true,
                dropCursor: false,
                allowMultipleSelections: false,
              }}
            />
          </div>
        </div>
      </div>

      {/* Styles */}
      <style>{`
        .toggle-checkbox { width: 24px; height: 24px; accent-color: #4f46e5; cursor: pointer; }
        
        /* Container pour l'éditeur */
        .editor-container {
          display: flex;
          flex-direction: column;
          height: 100%;
        }
        
        .codemirror-wrapper {
          display: flex;
          flex-direction: column;
          position: relative;
        }
        
        .codemirror-wrapper > div {
          height: 100%;
          display: flex;
          flex-direction: column;
        }
        
        .codemirror-wrapper .cm-editor {
          height: 100%;
          display: flex;
          flex-direction: column;
        }
        
        .codemirror-wrapper .cm-scroller {
          flex: 1;
          overflow: auto !important;
        }
        
        /* Container pour JSON */
        .json-container {
          display: flex;
          flex-direction: column;
          flex: 1;
          min-height: 0;
        }
        
        .json-content {
          flex: 1;
          min-height: 0;
          width: 100%;
        }
        
        /* Scrollbars personnalisées pour meilleure visibilité */
        .overflow-auto::-webkit-scrollbar,
        .overflow-y-auto::-webkit-scrollbar,
        .overflow-x-auto::-webkit-scrollbar {
          width: 14px;
          height: 14px;
        }
        
        .overflow-auto::-webkit-scrollbar-track,
        .overflow-y-auto::-webkit-scrollbar-track,
        .overflow-x-auto::-webkit-scrollbar-track {
          background: ${darkMode ? '#1f2937' : '#f3f4f6'};
          border-radius: 7px;
        }
        
        .overflow-auto::-webkit-scrollbar-thumb,
        .overflow-y-auto::-webkit-scrollbar-thumb,
        .overflow-x-auto::-webkit-scrollbar-thumb {
          background: ${darkMode ? '#4b5563' : '#9ca3af'};
          border-radius: 7px;
          border: 3px solid ${darkMode ? '#1f2937' : '#f3f4f6'};
        }
        
        .overflow-auto::-webkit-scrollbar-thumb:hover,
        .overflow-y-auto::-webkit-scrollbar-thumb:hover,
        .overflow-x-auto::-webkit-scrollbar-thumb:hover {
          background: ${darkMode ? '#6b7280' : '#6b7280'};
        }
        
        /* CodeMirror scrollbar */
        .cm-scroller::-webkit-scrollbar {
          width: 14px;
          height: 14px;
        }
        
        .cm-scroller::-webkit-scrollbar-track {
          background: ${darkMode ? '#1f2937' : '#f3f4f6'};
          border-radius: 7px;
        }
        
        .cm-scroller::-webkit-scrollbar-thumb {
          background: ${darkMode ? '#4b5563' : '#9ca3af'};
          border-radius: 7px;
          border: 3px solid ${darkMode ? '#1f2937' : '#f3f4f6'};
        }
        
        .cm-scroller::-webkit-scrollbar-thumb:hover {
          background: ${darkMode ? '#6b7280' : '#6b7280'};
        }
        
        /* Firefox scrollbar */
        .overflow-auto,
        .overflow-y-auto,
        .overflow-x-auto,
        .cm-scroller {
          scrollbar-width: thin;
          scrollbar-color: ${darkMode ? '#4b5563 #1f2937' : '#9ca3af #f3f4f6'};
        }
      `}</style>
    </div>
  );
}
