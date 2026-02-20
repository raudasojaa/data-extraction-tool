export interface Article {
  id: string;
  title: string | null;
  authors: string | null;
  journal: string | null;
  year: number | null;
  doi: string | null;
  page_count: number | null;
  status: string;
  project_id: string | null;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
}

export interface PdfPage {
  page_number: number;
  width: number;
  height: number;
  text_content: string | null;
  word_data: WordData[] | null;
}

export interface WordData {
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  block: number;
  line: number;
  word: number;
}
