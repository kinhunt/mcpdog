# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.2.6] - 2025-10-19

### Fixed
- **Critical**: Fixed tool name prefix stripping logic in ToolRouter that was incorrectly removing prefixes from tools with hyphens in their names
  - Previously, tools like `browserman-local-tonghuashun_post` were incorrectly parsed as `local-tonghuashun_post`
  - Now correctly checks if tool name starts with the server prefix before stripping
  - This fixes platform parameter mapping errors when using MCPDog as a proxy for servers with hyphenated tool names

### Changed
- Improved tool routing logic to be more precise about server prefix detection
- Updated prefix stripping to use `startsWith()` check instead of generic string splitting

## [2.2.5] - 2025-XX-XX

### Added
- Previous features and improvements

## [Unreleased]

### Planned
- Enhanced error reporting for tool routing failures
- Better logging for prefix stripping operations
