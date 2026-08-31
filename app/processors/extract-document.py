import argparse
import asyncio
import json
import os
import sys
import time
from pathlib import Path

import docling
import xberg
from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions, RapidOcrOptions
from docling.document_converter import DocumentConverter, PdfFormatOption
from docling_core.types.doc.document import ContentLayer
from xberg import ContentFilterConfig, ExtractInput, extract


def ensure_ascii_json(value):
    return json.dumps(to_jsonable(value), ensure_ascii=False, indent=2)


def write_text(path: Path, content: str):
    path.write_text(content, encoding="utf-8")


def write_json(path: Path, content):
    path.write_text(ensure_ascii_json(content), encoding="utf-8")


def to_jsonable(value, depth=0):
    if depth > 6:
        return "<max-depth>"
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, Path):
        return str(value)
    if isinstance(value, list):
        return [to_jsonable(item, depth + 1) for item in value]
    if isinstance(value, tuple):
        return [to_jsonable(item, depth + 1) for item in value]
    if isinstance(value, dict):
        return {str(key): to_jsonable(item, depth + 1) for key, item in value.items()}
    if hasattr(value, "model_dump"):
        return to_jsonable(value.model_dump(), depth + 1)
    if hasattr(value, "__dict__"):
        return {str(key): to_jsonable(item, depth + 1) for key, item in value.__dict__.items()}
    return repr(value)


def build_docling_converter(ocr_mode: str):
    pipeline_options = PdfPipelineOptions()
    if ocr_mode == "never":
        pipeline_options.do_ocr = False
        pipeline_options.do_table_structure = False
        pipeline_options.generate_parsed_pages = False
        pipeline_options.force_backend_text = True
    else:
        pipeline_options.do_ocr = True
        pipeline_options.do_table_structure = True
        pipeline_options.generate_parsed_pages = True
        pipeline_options.ocr_options = RapidOcrOptions(
            lang=["latin"],
            backend="onnxruntime",
            print_verbose=False,
            force_full_page_ocr=(ocr_mode == "force"),
        )
    return DocumentConverter(
        format_options={
            InputFormat.PDF: PdfFormatOption(
                pipeline_options=pipeline_options,
            ),
        },
    )


def build_docling_projections(document):
    body_layers = {ContentLayer.BODY}
    complete_layers = {ContentLayer.BODY, ContentLayer.FURNITURE}
    return {
        "text_content": document.export_to_text(included_content_layers=body_layers) or "",
        "complete_text_content": document.export_to_text(included_content_layers=complete_layers) or "",
        "markdown_content": document.export_to_markdown(included_content_layers=body_layers) or "",
    }


def run_docling(input_path: Path, artifact_dir: Path, profile_key: str, ocr_mode: str):
    converter = build_docling_converter(ocr_mode)
    result = converter.convert(str(input_path))
    document = result.document
    native_document = document.export_to_dict()
    projections = build_docling_projections(document)
    text_content = projections["text_content"]
    complete_text_content = projections["complete_text_content"]
    markdown_content = projections["markdown_content"]
    write_json(artifact_dir / "native.json", native_document)
    write_text(artifact_dir / "text.txt", text_content)
    write_text(artifact_dir / "markdown.md", markdown_content)
    write_text(artifact_dir / "complete-text.txt", complete_text_content)
    return {
        "processor_key": "docling",
        "processor_version": docling.__version__,
        "profile_key": profile_key,
        "format_family": "pdf",
        "ocr_mode": ocr_mode,
        "native_artifact": "native.json",
        "artifact_files": ["native.json", "text.txt", "markdown.md", "complete-text.txt"],
        "text_artifact": "text.txt",
        "complete_text_artifact": "complete-text.txt",
        "markdown_artifact": "markdown.md",
        "summary": {
            "page_count": len(native_document.get("pages", {}) or {}),
            "table_count": len(native_document.get("tables", []) or []),
            "text_length": len(text_content),
            "complete_text_length": len(complete_text_content),
            "markdown_length": len(markdown_content),
            "native_root_keys": list(native_document.keys()),
        },
        "native_summary": {
            "origin": native_document.get("origin"),
            "pages": list((native_document.get("pages", {}) or {}).keys())[:20],
        },
    }


def build_xberg_config(ocr_mode: str):
    config = {
        "include_document_structure": True,
        "enable_quality_processing": True,
        "pages": {
            "extract_pages": True,
            "insert_page_markers": False,
        },
        "content_filter": ContentFilterConfig(
            include_headers=True,
            include_footers=True,
            strip_repeating_text=False,
            include_watermarks=False,
        ),
    }
    if ocr_mode == "never":
        config["disable_ocr"] = True
    elif ocr_mode == "force":
        config["force_ocr"] = True
    return config


async def run_xberg_async(input_path: Path, artifact_dir: Path, profile_key: str, ocr_mode: str):
    config = build_xberg_config(ocr_mode)

    output = await extract(
        ExtractInput(kind="uri", uri=str(input_path)),
        config,
    )
    document = output.results[0]
    text_content = getattr(document, "content", "") or ""
    markdown_content = getattr(document, "formatted_content", None) or getattr(document, "djot_content", "") or ""
    native_document = {
        "summary": to_jsonable(getattr(output, "summary", None)),
        "document": to_jsonable(document),
    }
    write_json(artifact_dir / "native.json", native_document)
    write_text(artifact_dir / "text.txt", text_content)
    write_text(artifact_dir / "complete-text.txt", text_content)
    if markdown_content:
        write_text(artifact_dir / "formatted.md", markdown_content)
        artifact_files = ["native.json", "text.txt", "complete-text.txt", "formatted.md"]
    else:
        artifact_files = ["native.json", "text.txt", "complete-text.txt"]
    pages = getattr(document, "pages", None) or []
    tables = getattr(document, "tables", None) or []
    ocr_elements = getattr(document, "ocr_elements", None) or []
    processing_warnings = getattr(document, "processing_warnings", None) or []
    return {
        "processor_key": "xberg",
        "processor_version": xberg.__version__,
        "profile_key": profile_key,
        "format_family": "pdf",
        "ocr_mode": ocr_mode,
        "native_artifact": "native.json",
        "artifact_files": artifact_files,
        "text_artifact": "text.txt",
        "complete_text_artifact": "complete-text.txt",
        "markdown_artifact": "formatted.md" if markdown_content else None,
        "summary": {
            "page_count": len(pages),
            "table_count": len(tables),
            "ocr_element_count": len(ocr_elements),
            "warning_count": len(processing_warnings),
            "text_length": len(text_content),
            "complete_text_length": len(text_content),
            "markdown_length": len(markdown_content),
            "quality_score": getattr(document, "quality_score", None),
            "extraction_confidence": getattr(document, "extraction_confidence", None),
            "extraction_method": getattr(document, "extraction_method", None),
            "detected_languages": to_jsonable(getattr(document, "detected_languages", None)),
        },
        "native_summary": {
            "has_document_structure": getattr(document, "document", None) is not None,
            "has_structured_output": getattr(document, "structured_output", None) is not None,
        },
    }


def run_xberg(input_path: Path, artifact_dir: Path, profile_key: str, ocr_mode: str):
    return asyncio.run(run_xberg_async(input_path, artifact_dir, profile_key, ocr_mode))


def run_plain_text(input_path: Path, artifact_dir: Path, profile_key: str):
    text_content = input_path.read_text(encoding="utf-8")
    write_text(artifact_dir / "text.txt", text_content)
    write_json(
        artifact_dir / "native.json",
        {
            "source_path": str(input_path),
            "profile_key": profile_key,
            "kind": "plain_text_passthrough",
        },
    )
    return {
        "processor_key": "plain_text_passthrough",
        "processor_version": "builtin-v1",
        "profile_key": profile_key,
        "format_family": "text",
        "ocr_mode": "never",
        "native_artifact": "native.json",
        "artifact_files": ["native.json", "text.txt"],
        "text_artifact": "text.txt",
        "markdown_artifact": None,
        "summary": {
            "page_count": 0,
            "table_count": 0,
            "text_length": len(text_content),
            "markdown_length": 0,
        },
        "native_summary": {},
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--engine", choices=["docling", "xberg", "plain_text"], required=True)
    parser.add_argument("--input-path", required=True)
    parser.add_argument("--artifact-dir", required=True)
    parser.add_argument("--profile-key", required=True)
    parser.add_argument("--ocr-mode", choices=["auto", "never", "force"], default="auto")
    args = parser.parse_args()

    input_path = Path(args.input_path).resolve()
    artifact_dir = Path(args.artifact_dir).resolve()
    artifact_dir.mkdir(parents=True, exist_ok=True)

    started = time.time()
    try:
        if args.engine == "docling":
            payload = run_docling(input_path, artifact_dir, args.profile_key, args.ocr_mode)
        elif args.engine == "xberg":
            payload = run_xberg(input_path, artifact_dir, args.profile_key, args.ocr_mode)
        else:
            payload = run_plain_text(input_path, artifact_dir, args.profile_key)
        payload["duration_ms"] = round((time.time() - started) * 1000)
        write_json(artifact_dir / "summary.json", payload)
        print(ensure_ascii_json(payload))
    except Exception as error:
        error_payload = {
            "engine": args.engine,
            "profile_key": args.profile_key,
            "ocr_mode": args.ocr_mode,
            "error_type": type(error).__name__,
            "error_message": str(error),
            "duration_ms": round((time.time() - started) * 1000),
        }
        write_json(artifact_dir / "failure.json", error_payload)
        print(ensure_ascii_json(error_payload), file=sys.stderr)
        raise


if __name__ == "__main__":
    main()
