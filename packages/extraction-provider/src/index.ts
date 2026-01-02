/**
 * Text Extraction Provider Package
 *
 * Strategy Pattern + Dependency Injection for text extraction.
 * Supports multiple sources: URLs, local files, S3, etc.
 */

// Re-export types from common
export {
  ITextExtractor,
  TextExtractionInput,
  TextExtractionResult,
  NoExtractorFoundError,
  ExtractionError,
} from "@qckstrt/common";

// Provider types
export * from "./types.js";

// Extractor implementations
export * from "./extractors/url.extractor.js";

// Service
export * from "./extraction.service.js";

// NestJS Module
export * from "./extraction.module.js";
