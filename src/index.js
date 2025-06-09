

import seqcode from "seqcode";

import { seqcode as seqcodeLang } from "codemirror-lang-seqcode"
import { basicSetup } from "codemirror"
import { EditorView, ViewPlugin, Decoration } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { vsCodeLight } from '@fsegurai/codemirror-theme-vscode-light'
import {StateField, StateEffect} from "@codemirror/state"

const MIN_NOTE_WIDTH = 50
const DEBUG = false

const MAX_ZOOM = 0.5
const MIN_ZOOM = 2.0
const ZOOM_STEP = 0.1
const ZOOM_NONE = 1.0

let zoom = ZOOM_NONE

function setZoom() {
  const svg = document.querySelector("#diagram svg");
  const w = svg.getBBox().width
  const h = svg.getBBox().height

  svg.setAttribute('width',`${Math.floor(w*zoom)}px`)
  svg.setAttribute('height', `${Math.floor(h*zoom)}px`)
}


const editorContainer = document.getElementById("editor-container")
const diagramContainer = document.getElementById("diagram-container")
const diagram = document.getElementById("diagram")
const editor = document.getElementById("editor")
const source = document.getElementById("seqcode").innerText
const showEditor = document.getElementById('show-editor')

showEditor.addEventListener('click', (ev) => {
  document.body.classList.remove('full-width')
})

document.getElementById('hideEditor').addEventListener('click', (ev) => {
  document.body.classList.add('full-width')
})

document.getElementById('zoomIn').addEventListener('click', (ev) => {
  zoom = Math.min(MIN_ZOOM,zoom + ZOOM_STEP)
  setZoom()
},true)
document.getElementById('zoomOut').addEventListener('click', (ev) => {
  zoom = Math.max(MAX_ZOOM,zoom - ZOOM_STEP)
  setZoom()
},true)
document.getElementById('zoomActual').addEventListener('click', (ev) => {
  zoom = ZOOM_NONE
  setZoom()
})

const sas = document.getElementById('saveAsSVG')

sas.addEventListener('click', (ev) => {
  ev.target.parentElement.parentElement.classList.add('no-hover')
  setTimeout(() => ev.target.parentElement.parentElement.classList.remove('no-hover'), 1000)

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

// https://lezer-playground.vercel.app

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


let wasMoved = false
let mousedown = null
let diagramMouseMove = null
let notes = null

// Effects can be attached to transactions to communicate with the extension
const addMarks = StateEffect.define(), filterMarks = StateEffect.define()

// This value must be added to the set of extensions to enable this
const markField = StateField.define({
  // Start with an empty set of decorations
  create() { return Decoration.none },
  // This is called whenever the editor updates—it computes the new set
  update(value, tr) {
    // Move the decorations to account for document changes
    value = value.map(tr.changes)
    // If this transaction adds or removes decorations, apply those changes
    for (let effect of tr.effects) {
      if (effect.is(addMarks)) value = value.update({add: effect.value, sort: true})
      else if (effect.is(filterMarks)) value = value.update({filter: effect.value})
    }
    return value
  },
  // Indicate that this field provides a set of decorations
  provide: f => EditorView.decorations.from(f)
})


const view = new EditorView({
  doc: source,
  parent: editor,
  updateListener: (update) => {
    // console.log(update)
    // if (update.changes) {
    //   console.log("Document changed:", update.state.doc.toString());
    // }
  },
  extensions: [
    basicSetup,
    markField,
    vsCodeLight,
    seqcodeLang(),
    ViewPlugin.fromClass(class {
      constructor(view) { }
      update(update) {
        if (update.docChanged) {
          if (mousedown) return
          render(update.state)
        }
      }
    })
  ]
})


diagram.addEventListener('mouseup', (ev) => {
  if (mousedown) {
    mousedown = null
    render(view.state)
  }
  ev.preventDefault()
},true)

let mouseIn = false
diagram.addEventListener('mouseenter',() => {
  if (!mouseIn) {
    mouseIn = true
    addNoteControls()
  }
},true);

diagram.addEventListener('mouseleave',(ev) => {
  if (mouseIn) {
    mouseIn = false
    removeNoteControls()

    if (mousedown) {
      mousedown = null
      render(view.state)
    }

  } else {
    if (DEBUG) console.warn("mouse leave but wasn't in")
  }
  ev.preventDefault()
})

// TODO: export this from seqcode package
function parseNote(note) {
  const params = note.substring(5, note.length - 1)

  var ss = params.split(",");
  if (ss.length < 4) {
    return null;
  }
  var x = parseInt(ss[0]);
  var y = parseInt(ss[1]);
  var w = parseInt(ss[2]);
  if (isNaN(x) || x != ss[0] || isNaN(y) || y != ss[1] || isNaN(w) || w != ss[2]) {
    return null;
  }
  ss.shift();
  ss.shift();
  ss.shift();
  var text = ss.join(",").trim();
  return { x, y, w, text }
}

function getNotes(state) {
  let notes = []
  const txt = state.doc.toString()
  syntaxTree(state).iterate({
    enter: (node) => {
      if (node.name == 'SelfCall') {
        const str = txt.substring(node.from, node.to)
        if (str.startsWith('note(')) {
          try {
            const { x, y, w, text } = parseNote(str)
            notes.push({
              from: node.from,
              to: node.to,
              src: str,
              x,
              y,
              w,
              text
            })
          } catch (e) {
            // failed to parse
          }
        }
      }
    },
  })
  return notes
}

window.clickLink = function (link) {
  if (wasMoved) {
    wasMoved = false
    return
  }
  window.location = link
}

const NOTE_HANDLE_SIZE = 10
const linkHandler = {
  href: (link) => '#',
  target: (link) => '',
  onclick: (link) => `clickLink(decodeURIComponent("${encodeURIComponent(link)}"))`
}

function addNoteControls() {
  if (notes != null) {
    if (DEBUG) console.error('note controls exist')
    return
  }
  notes = getNotes(view.state)
  let noteElements = document.getElementsByClassName('note')

  for (let noteElement of noteElements) {
    let noteBBox = noteElement.getBBox()
    let sourceNote = null

    for (let n of notes) {
      if (n.x == noteBBox.x
        && n.y == noteBBox.y
        && n.w == noteBBox.width) {
        sourceNote = n
      }
    }

    if (sourceNote == null) {
      if (DEBUG) {
        console.error("unable to find source for note element")
        console.log('looking for:',noteElement)
        console.log('bbox',noteBBox)
        console.log('notes',notes)
      }
      continue
    }

    sourceNote.element = noteElement
    sourceNote.bb = sourceNote.element.getBBox()

    // drag handle in top-left corner
    sourceNote.dragHandle = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    sourceNote.dragHandle.setAttribute("x", sourceNote.bb.x); // x-coordinate of the top-left corner
    sourceNote.dragHandle.setAttribute("y", sourceNote.bb.y); // y-coordinate of the top-left corner
    sourceNote.dragHandle.setAttribute("width", NOTE_HANDLE_SIZE); // width of the rectangle
    sourceNote.dragHandle.setAttribute("height", NOTE_HANDLE_SIZE); // height of the rectangle
    sourceNote.dragHandle.setAttribute("fill", "#ddd"); // fill color of the rectangle
    sourceNote.dragHandle.style.cursor = 'move'
    noteElement.appendChild(sourceNote.dragHandle);

    // resize handle on right edge
    sourceNote.resizeHandle = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    sourceNote.resizeHandle.setAttribute("x", sourceNote.bb.x + sourceNote.bb.width - NOTE_HANDLE_SIZE); // x-coordinate of the top-left corner
    sourceNote.resizeHandle.setAttribute("y", sourceNote.bb.y); // y-coordinate of the top-left corner
    sourceNote.resizeHandle.setAttribute("width", NOTE_HANDLE_SIZE); // width of the rectangle
    sourceNote.resizeHandle.setAttribute("height", sourceNote.bb.height); // height of the rectangle
    sourceNote.resizeHandle.setAttribute("fill", "#ddd"); // fill color of the rectangle
    sourceNote.resizeHandle.style.cursor = 'col-resize'
    noteElement.appendChild(sourceNote.resizeHandle);

    sourceNote.dragHandle.addEventListener('mousedown', (ev) => {

      mousedown = {
        x: ev.clientX,
        y: ev.clientY,
        note: noteElement,
        translation: { x: 0, y: 0 },
        sourceNote,
        noteX: sourceNote.bb.x,
        noteY: sourceNote.bb.y,
      }

      // prevents click on handle, even if not actually moved
      wasMoved = true
      ev.preventDefault();
    }, true)

    sourceNote.resizeHandle.addEventListener('mousedown', (ev) => {


      let childrenToRemove = []
      for (let ch of noteElement.children) {
        if (ch.tagName != 'rect') {
          childrenToRemove.push(ch)
        }
      }
      while (childrenToRemove.length > 0) {
        noteElement.removeChild(childrenToRemove.pop())
      }

      sourceNote.tempBackground = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      sourceNote.tempBackground.setAttribute("x", sourceNote.bb.x); // x-coordinate of the top-left corner
      sourceNote.tempBackground.setAttribute("y", sourceNote.bb.y); // y-coordinate of the top-left corner
      sourceNote.tempBackground.setAttribute("width", sourceNote.bb.width); // width of the rectangle
      sourceNote.tempBackground.setAttribute("height", sourceNote.bb.height); // height of the rectangle
      sourceNote.tempBackground.setAttribute("fill", "#FFEB5B"); // fill color of the rectangle
      sourceNote.tempBackground.setAttribute("stroke","#eeeeee")
      sourceNote.tempBackground.setAttribute("stroke-width","1")
      noteElement.insertBefore(sourceNote.tempBackground,sourceNote.element.firstChild);
      
      mousedown = {
        x: ev.clientX,
        y: ev.clientY,
        note: noteElement,
        sourceNote,
        noteW: sourceNote.bb.width,
        resizeHandle: sourceNote.resizeHandle,
        tempBackground: sourceNote.tempBackground
      }

      // prevents click on handle, even if not actually moved
      wasMoved = true
      ev.preventDefault();
    }, true)

  }

  diagram.removeEventListener('mousemove',diagramMouseMove,true)
  diagramMouseMove = function (ev) {
    if (mousedown) {
      let deltaX = ev.clientX - mousedown.x
      let deltaY = ev.clientY - mousedown.y

      if (mousedown.translation) {
        let newTranslationX = mousedown.translation.x + deltaX
        let newTranslationY = mousedown.translation.y + deltaY
        let newX = mousedown.noteX + deltaX
        if (newX<0) {
          newTranslationX += -newX
          newX = 0
        }
        let newY = mousedown.noteY + deltaY
        if (newY<0) {
          newTranslationY += -newY
          newY = 0
        }
        mousedown.note.setAttribute('transform', `translate(${newTranslationX}, ${newTranslationY})`);

        let newNoteText = `note( ${newX}, ${newY}, ${mousedown.sourceNote.w}, ${mousedown.sourceNote.text} )`

        view.dispatch({
          changes: { from: mousedown.sourceNote.from, to: mousedown.sourceNote.to, insert: newNoteText }
        })

        mousedown.sourceNote.to = mousedown.sourceNote.from + newNoteText.length
      } else if (mousedown.noteW) {
        const newWidth = Math.max(MIN_NOTE_WIDTH,mousedown.sourceNote.w + deltaX)
        mousedown.resizeHandle.setAttribute('x', mousedown.sourceNote.x + newWidth - NOTE_HANDLE_SIZE);
        mousedown.tempBackground.setAttribute('width', newWidth);
        let newNoteText = `note( ${mousedown.sourceNote.x}, ${mousedown.sourceNote.y}, ${newWidth}, ${mousedown.sourceNote.text} )`

        view.dispatch({
          changes: { from: mousedown.sourceNote.from, to: mousedown.sourceNote.to, insert: newNoteText }
        })

        mousedown.sourceNote.to = mousedown.sourceNote.from + newNoteText.length
      }
      ev.preventDefault();
    }
  }
  diagram.addEventListener('mousemove', diagramMouseMove, true);
}

function removeNoteControls() {
  if (notes == null) {
    if (DEBUG) console.warn('removeNoteControls called when no controls')
    return
  }

  for (let note of notes) {
    if (note.element && note.dragHandle) note.element.removeChild(note.dragHandle)
    if (note.element && note.resizeHandle) note.element.removeChild(note.resizeHandle)
  }
  notes = null
  diagram.removeEventListener('mousemove',diagramMouseMove,true)
}

function render(state) {
  const txt = state.doc.toString();
  let { svg, errors } = seqcode(txt, {
    foreground: '#666',
    linkHandler,
    noteFontFace: '"Patrick Hand", cursive',
    noteFontSize: 15,
  })
  diagram.innerHTML = ''
  diagram.appendChild(svg.node)
  if (notes) {
    removeNoteControls()
  }
  if (mouseIn) {
    addNoteControls()    
  }
  if (errors) console.log(errors)

}

render(view.state)
