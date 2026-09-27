/**
 * Target-Size Document Converter
 * Client-side PDF to Word (.docx) and Word (.docx) to PDF converter.
 * Uses pdf.js, mammoth.js, jspdf, and JSZip.
 */

export async function convertPdfToWord({ file, onProgress = () => {} }) {
  onProgress(10, 'Initializing PDF parser...');

  if (!window.pdfjsLib) {
    throw new Error('PDF.js library not loaded.');
  }
  if (!window.JSZip) {
    throw new Error('JSZip library not loaded.');
  }

  window.pdfjsLib.GlobalWorkerOptions.workerSrc = './pdf.worker.min.js';

  const fileData = await file.arrayBuffer();
  const pdfDoc = await window.pdfjsLib.getDocument({ data: fileData }).promise;
  const numPages = pdfDoc.numPages;

  const pageParagraphs = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const pct = Math.round(15 + ((pageNum / numPages) * 70));
    onProgress(pct, `Extracting text & formatting from page ${pageNum} of ${numPages}...`);

    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();
    
    // Sort items by vertical position (Y descending) then horizontal (X ascending)
    const items = textContent.items.map(item => ({
      str: item.str,
      x: item.transform[4],
      y: item.transform[5],
      fontSize: Math.round(Math.sqrt(item.transform[0] * item.transform[0] + item.transform[1] * item.transform[1])),
      hasEOL: item.hasEOL
    }));

    items.sort((a, b) => {
      const yDiff = b.y - a.y;
      if (Math.abs(yDiff) > 4) return yDiff; // Different line
      return a.x - b.x; // Same line
    });

    // Group into lines/paragraphs
    const lines = [];
    let curLine = [];
    let lastY = null;

    items.forEach(it => {
      if (lastY === null || Math.abs(it.y - lastY) > 5) {
        if (curLine.length > 0) {
          lines.push(curLine.map(t => t.str).join(' '));
          curLine = [];
        }
        lastY = it.y;
      }
      if (it.str.trim().length > 0) {
        curLine.push(it);
      }
    });
    if (curLine.length > 0) {
      lines.push(curLine.map(t => t.str).join(' '));
    }

    pageParagraphs.push(lines);
  }

  onProgress(88, 'Generating Microsoft Word (.docx) OpenXML structure...');

  // Assemble Word .docx XML structure
  const zip = new window.JSZip();

  // 1. [Content_Types].xml
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`);

  // 2. _rels/.rels
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);

  // 3. word/_rels/document.xml.rels
  zip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`);

  // 4. word/styles.xml
  zip.file('word/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
        <w:sz w:val="22"/>
        <w:color w:val="1F2937"/>
      </w:rPr>
    </w:rPrDefault>
  </w:docDefaults>
</w:styles>`);

  // 5. word/document.xml with paragraphs and page breaks
  let bodyXml = '';
  pageParagraphs.forEach((pageLines, pageIdx) => {
    if (pageIdx > 0) {
      bodyXml += `<w:p><w:r><w:br w:type="page"/></w:r></w:p>`;
    }
    pageLines.forEach(line => {
      const cleanText = escapeXml(line);
      bodyXml += `<w:p><w:pPr><w:spacing w:after="140" w:line="276" w:lineRule="auto"/></w:pPr><w:r><w:t xml:space="preserve">${cleanText}</w:t></w:r></w:p>`;
    });
  });

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${bodyXml}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  zip.file('word/document.xml', documentXml);

  onProgress(95, 'Packaging .docx file...');
  const docxBlob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

  onProgress(100, 'Conversion complete!');

  return {
    success: true,
    blob: docxBlob,
    sizeBytes: docxBlob.size,
    outputUrl: URL.createObjectURL(docxBlob),
    filename: file.name.replace(/\.pdf$/i, '') + '.docx',
    numPages
  };
}

export async function convertWordToPdf({ file, onProgress = () => {} }) {
  onProgress(15, 'Reading Word document...');

  if (!window.mammoth) {
    throw new Error('Mammoth.js library not loaded.');
  }
  if (!window.jspdf || !window.jspdf.jsPDF) {
    throw new Error('jsPDF library not loaded.');
  }

  const arrayBuffer = await file.arrayBuffer();

  onProgress(35, 'Parsing document paragraphs and typography...');
  const result = await window.mammoth.extractRawText({ arrayBuffer });
  const rawText = result.value || '';

  onProgress(60, 'Rendering PDF pages...');
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({
    unit: 'pt',
    format: 'letter'
  });

  const margin = 54; // 0.75 inch
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxLineWidth = pageWidth - (margin * 2);

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);

  const lines = rawText.split('\n');
  let cursorY = margin + 16;
  const lineHeight = 16;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) {
      cursorY += 8; // Paragraph gap
      continue;
    }

    const wrappedLines = doc.splitTextToSize(rawLine, maxLineWidth);

    for (let j = 0; j < wrappedLines.length; j++) {
      if (cursorY + lineHeight > pageHeight - margin) {
        doc.addPage();
        cursorY = margin + 16;
      }
      doc.text(wrappedLines[j], margin, cursorY);
      cursorY += lineHeight;
    }
  }

  onProgress(90, 'Finalizing PDF output...');
  const pdfBlob = doc.output('blob');

  onProgress(100, 'Word to PDF conversion complete!');

  return {
    success: true,
    blob: pdfBlob,
    sizeBytes: pdfBlob.size,
    outputUrl: URL.createObjectURL(pdfBlob),
    filename: file.name.replace(/\.docx?$/i, '') + '.pdf'
  };
}

function escapeXml(unsafe) {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}
