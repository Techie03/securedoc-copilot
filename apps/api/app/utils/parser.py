import io
import csv
from typing import List, Dict, Any, Optional
import pypdf
import docx

def split_text_recursive(text: str, chunk_size: int = 1000, chunk_overlap: int = 200) -> List[str]:
    """
    Splits text recursively using different separators: paragraphs, sentences, words, characters.
    """
    separators = ["\n\n", "\n", ". ", " ", ""]
    
    def _split(text_to_split: str, separators_list: List[str]) -> List[str]:
        if len(text_to_split) <= chunk_size:
            return [text_to_split]
            
        if not separators_list:
            # If no separators left, split by chunk_size
            return [text_to_split[i:i+chunk_size] for i in range(0, len(text_to_split), chunk_size)]
            
        separator = separators_list[0]
        splits = text_to_split.split(separator)
        
        chunks = []
        current_chunk = []
        current_length = 0
        
        for part in splits:
            part_len = len(part)
            # If a single part exceeds the chunk size, split it recursively with next separators
            if part_len > chunk_size:
                # Flush current chunk
                if current_chunk:
                    chunks.append(separator.join(current_chunk))
                    current_chunk = []
                    current_length = 0
                
                # Recursively split the large part
                sub_splits = _split(part, separators_list[1:])
                chunks.extend(sub_splits)
            else:
                # If adding this part exceeds chunk_size, we need to flush and start a new chunk
                sep_len = len(separator) if current_chunk else 0
                if current_length + sep_len + part_len > chunk_size:
                    chunks.append(separator.join(current_chunk))
                    
                    # Keep overlap elements
                    overlap_chunk = []
                    overlap_len = 0
                    # Go backwards to add overlapping elements
                    for prev_part in reversed(current_chunk):
                        prev_part_len = len(prev_part)
                        prev_sep_len = len(separator) if overlap_chunk else 0
                        if overlap_len + prev_sep_len + prev_part_len <= chunk_overlap:
                            overlap_chunk.insert(0, prev_part)
                            overlap_len += prev_sep_len + prev_part_len
                        else:
                            break
                    
                    current_chunk = overlap_chunk
                    current_length = overlap_len
                    
                current_chunk.append(part)
                current_length += (len(separator) if len(current_chunk) > 1 else 0) + part_len
                
        if current_chunk:
            chunks.append(separator.join(current_chunk))
            
        # Filter out empty chunks and strip whitespace
        return [c.strip() for c in chunks if c.strip()]

    return _split(text, separators)


def parse_pdf(file_bytes: bytes) -> List[Dict[str, Any]]:
    """
    Parses a PDF file page by page and chunks each page.
    """
    try:
        reader = pypdf.PdfReader(io.BytesIO(file_bytes))
        chunks = []
        for page_idx, page in enumerate(reader.pages):
            text = page.extract_text()
            if not text:
                continue
            
            # Split text on this page
            page_chunks = split_text_recursive(text, chunk_size=1000, chunk_overlap=200)
            for chunk_text in page_chunks:
                chunks.append({
                    "content": chunk_text,
                    "page_number": page_idx + 1,
                    "token_count": len(chunk_text) // 4
                })
        return chunks
    except Exception as e:
        print(f"Error parsing PDF: {e}")
        raise ValueError(f"Failed to parse PDF document: {str(e)}")


def parse_docx(file_bytes: bytes) -> List[Dict[str, Any]]:
    """
    Parses a DOCX file and chunks the full text.
    """
    try:
        doc = docx.Document(io.BytesIO(file_bytes))
        full_text = []
        for para in doc.paragraphs:
            if para.text.strip():
                full_text.append(para.text)
        
        text = "\n".join(full_text)
        text_chunks = split_text_recursive(text, chunk_size=1000, chunk_overlap=200)
        return [
            {
                "content": chunk_text,
                "page_number": 1,
                "token_count": len(chunk_text) // 4
            }
            for chunk_text in text_chunks
        ]
    except Exception as e:
        print(f"Error parsing DOCX: {e}")
        raise ValueError(f"Failed to parse Word document: {str(e)}")


def parse_csv(file_bytes: bytes) -> List[Dict[str, Any]]:
    """
    Parses a CSV file, representing rows as structured key-value pairs.
    """
    try:
        content_str = file_bytes.decode("utf-8", errors="ignore")
        reader = csv.reader(io.StringIO(content_str))
        rows = list(reader)
        if not rows:
            return []
        
        header = rows[0]
        formatted_rows = []
        for row in rows[1:]:
            row_str = ", ".join([f"{header[i]}: {row[i]}" for i in range(min(len(header), len(row)))])
            if row_str.strip():
                formatted_rows.append(row_str)
                
        text = "\n".join(formatted_rows)
        text_chunks = split_text_recursive(text, chunk_size=1000, chunk_overlap=200)
        return [
            {
                "content": chunk_text,
                "page_number": 1,
                "token_count": len(chunk_text) // 4
            }
            for chunk_text in text_chunks
        ]
    except Exception as e:
        print(f"Error parsing CSV: {e}")
        raise ValueError(f"Failed to parse CSV document: {str(e)}")


def parse_txt(file_bytes: bytes) -> List[Dict[str, Any]]:
    """
    Parses a plain text or Markdown file and chunks it.
    """
    try:
        text = file_bytes.decode("utf-8", errors="ignore")
        text_chunks = split_text_recursive(text, chunk_size=1000, chunk_overlap=200)
        return [
            {
                "content": chunk_text,
                "page_number": 1,
                "token_count": len(chunk_text) // 4
            }
            for chunk_text in text_chunks
        ]
    except Exception as e:
        print(f"Error parsing plain text: {e}")
        raise ValueError(f"Failed to parse text document: {str(e)}")


def parse_document(file_bytes: bytes, filename: str) -> List[Dict[str, Any]]:
    """
    Routes parsing based on the file extension.
    """
    ext = filename.split(".")[-1].lower()
    
    if ext == "pdf":
        return parse_pdf(file_bytes)
    elif ext in ["docx", "doc"]:
        return parse_docx(file_bytes)
    elif ext in ["csv", "xlsx"]:
        # Excel can be exported/parsed as CSV for this stage
        return parse_csv(file_bytes)
    else:
        # Default to plain text parser for txt, md, log, json, etc.
        return parse_txt(file_bytes)
