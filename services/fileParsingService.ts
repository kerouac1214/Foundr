import * as mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';

// Configure PDF.js worker
// In a Vite environment, we might need a specific way to load the worker.
// This is a common pattern for pdfjs-dist in the browser.
GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

export const parseFile = async (file: File): Promise<string> => {
    const extension = file.name.split('.').pop()?.toLowerCase();

    switch (extension) {
        case 'docx':
            return parseDocx(file);
        case 'pdf':
            return parsePdf(file);
        case 'xlsx':
        case 'xls':
        case 'csv':
            return parseExcel(file);
        case 'md':
        case 'txt':
        default:
            return parseText(file);
    }
};

const parseText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = (e) => reject(new Error('Failed to read text file'));
        reader.readAsText(file);
    });
};

const parseDocx = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
};

const parsePdf = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ');
        fullText += pageText + '\n';
    }

    return fullText;
};

const parseExcel = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    let fullText = '';

    workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        // Convert to CSV-like text for easy reading in a script editor
        const sheetText = XLSX.utils.sheet_to_csv(worksheet);
        fullText += `--- Sheet: ${sheetName} ---\n${sheetText}\n\n`;
    });

    return fullText;
};
