

import seqcode from "seqcode";

import {seqcode as seqcodeLang} from "codemirror-lang-seqcode"
import { basicSetup } from "codemirror"
import { EditorView,ViewPlugin } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { vsCodeLight } from '@fsegurai/codemirror-theme-vscode-light'

const sas = document.getElementById('saveAsSVG')

sas.addEventListener('click', () => {
  const svg = document.querySelector("#diagram svg");
  if (!svg) {
    alert("No SVG diagram found.");
    return;
  }
  const serializer = new XMLSerializer();
  let svgString = serializer.serializeToString(svg);

  if (!source.match(/^<\?xml/)) {
    svgString = '<?xml version="1.0" standalone="no"?>\n' + svgString;
  }

  const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  sas.href = url;
  // const a = document.createElement("a");
  // a.href = url
  // a.download = "seqcode.svg"
  // document.body.appendChild(a);
  // a.click();
  // document.body.removeChild(a);
})

const sap = document.getElementById('saveAsPNG')
sap.addEventListener('click', () => {
  const svg = document.querySelector("#diagram svg");
  if (!svg) {
    alert("No SVG diagram found.");
    return;
  }
  const serializer = new XMLSerializer();
  let svgString = serializer.serializeToString(svg);

    // Create an image and canvas
  const img = new Image();
  const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  img.onload = function () {
    const canvas = document.createElement("canvas");
    canvas.width = svg.width.baseVal.value || 800;
    canvas.height = svg.height.baseVal.value || 600;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    // Create PNG download
    canvas.toBlob(function (blob) {
      const pngUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = pngUrl;
      a.download = "seqcode.png";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(pngUrl);
      URL.revokeObjectURL(url);
    }, "image/png");
  };

    img.onerror = function () {
    alert("Failed to convert SVG to PNG.");
    URL.revokeObjectURL(url);
  };

  img.src = url;

})

const sat = document.getElementById('saveAsTXT')
sat.addEventListener('click', () => {
  const text = view.state.doc.toString();
  const encoded = encodeURIComponent(text);
  sat.href = "data:text/plain;charset=utf-8," + encoded;
})

const diagram = document.getElementById("diagram")
const editor = document.getElementById("editor")
const source = document.getElementById("seqcode").innerText

diagram.innerHTML = seqcode(source,{fontFace: 'verdana'})

const view = new EditorView({
  doc: source,
  parent: editor,
  updateListener: (update) => {
    console.log(update)
    // if (update.changes) {
    //   console.log("Document changed:", update.state.doc.toString());
    // }
  },
  extensions: [
    basicSetup,
    vsCodeLight,
    seqcodeLang(),
    ViewPlugin.fromClass(class {
      constructor(view) {}

      update(update) {
        if (update.docChanged) {

          const txt = update.state.doc.toString();

          // syntaxTree(update.state).iterate({
          //   enter: (node) => {
          //     console.log(node.name, txt.substring(node.from, node.to))
          //   },
          // })

          diagram.innerHTML = seqcode(txt,{fontFace: 'verdana'})
        }
      }
    })
  ]
})
