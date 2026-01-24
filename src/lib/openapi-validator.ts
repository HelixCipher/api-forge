import { OpenAPISpec, ValidationResult, ValidationError } from '@/types/api';

export function validateOpenAPISpec(spec: OpenAPISpec): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Validate OpenAPI version
  if (!spec.openapi || !spec.openapi.startsWith('3.')) {
    errors.push({
      path: '/openapi',
      message: 'OpenAPI version must be 3.x.x',
      severity: 'error'
    });
  }

  // Validate info object
  if (!spec.info) {
    errors.push({
      path: '/info',
      message: 'Info object is required',
      severity: 'error'
    });
  } else {
    if (!spec.info.title) {
      errors.push({
        path: '/info/title',
        message: 'API title is required',
        severity: 'error'
      });
    }
    if (!spec.info.version) {
      errors.push({
        path: '/info/version',
        message: 'API version is required',
        severity: 'error'
      });
    }
    if (!spec.info.description) {
      warnings.push({
        path: '/info/description',
        message: 'API description is recommended',
        severity: 'warning'
      });
    }
  }

  // Validate paths
  if (!spec.paths || Object.keys(spec.paths).length === 0) {
    errors.push({
      path: '/paths',
      message: 'At least one path is required',
      severity: 'error'
    });
  } else {
    Object.entries(spec.paths).forEach(([path, pathItem]) => {
      // Validate path format
      if (!path.startsWith('/')) {
        errors.push({
          path: `/paths${path}`,
          message: `Path "${path}" must start with /`,
          severity: 'error'
        });
      }

      // Validate path parameters
      const pathParams = path.match(/\{([^}]+)\}/g) || [];
      
      // Check each operation
      const operations = ['get', 'post', 'put', 'patch', 'delete'] as const;
      operations.forEach(method => {
        const operation = pathItem[method];
        if (operation) {
          // Check for responses
          if (!operation.responses || Object.keys(operation.responses).length === 0) {
            errors.push({
              path: `/paths${path}/${method}/responses`,
              message: `Operation ${method.toUpperCase()} ${path} must have at least one response`,
              severity: 'error'
            });
          }

          // Check for operationId
          if (!operation.operationId) {
            warnings.push({
              path: `/paths${path}/${method}/operationId`,
              message: `Operation ${method.toUpperCase()} ${path} should have an operationId`,
              severity: 'warning'
            });
          }

          // Check for summary or description
          if (!operation.summary && !operation.description) {
            warnings.push({
              path: `/paths${path}/${method}`,
              message: `Operation ${method.toUpperCase()} ${path} should have a summary or description`,
              severity: 'warning'
            });
          }

          // Validate path parameters are defined
          pathParams.forEach(param => {
            const paramName = param.slice(1, -1);
            const hasParam = operation.parameters?.some(
              p => p.name === paramName && p.in === 'path'
            );
            const hasPathParam = pathItem.parameters?.some(
              p => p.name === paramName && p.in === 'path'
            );
            if (!hasParam && !hasPathParam) {
              errors.push({
                path: `/paths${path}/${method}/parameters`,
                message: `Path parameter "${paramName}" is not defined for ${method.toUpperCase()} ${path}`,
                severity: 'error'
              });
            }
          });

          // Check POST/PUT/PATCH have request body
          if (['post', 'put', 'patch'].includes(method) && !operation.requestBody) {
            warnings.push({
              path: `/paths${path}/${method}/requestBody`,
              message: `${method.toUpperCase()} ${path} typically should have a request body`,
              severity: 'warning'
            });
          }
        }
      });
    });
  }

  // Validate components/schemas references
  if (spec.components?.schemas) {
    const schemaNames = Object.keys(spec.components.schemas);
    
    // Check for undefined references
    const checkRefs = (obj: unknown, currentPath: string) => {
      if (obj && typeof obj === 'object') {
        if ('$ref' in obj) {
          const ref = (obj as { $ref: string }).$ref;
          if (ref.startsWith('#/components/schemas/')) {
            const schemaName = ref.replace('#/components/schemas/', '');
            if (!schemaNames.includes(schemaName)) {
              errors.push({
                path: currentPath,
                message: `Reference to undefined schema: ${schemaName}`,
                severity: 'error'
              });
            }
          }
        } else {
          Object.entries(obj as Record<string, unknown>).forEach(([key, value]) => {
            checkRefs(value, `${currentPath}/${key}`);
          });
        }
      }
    };

    checkRefs(spec.paths, '/paths');
    checkRefs(spec.components, '/components');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

export function formatValidationMessage(result: ValidationResult): string {
  if (result.valid && result.warnings.length === 0) {
    return '✅ Specification is valid!';
  }

  const parts: string[] = [];
  
  if (result.errors.length > 0) {
    parts.push(`❌ ${result.errors.length} error(s):`);
    result.errors.forEach(e => {
      parts.push(`  • ${e.path}: ${e.message}`);
    });
  }

  if (result.warnings.length > 0) {
    parts.push(`⚠️ ${result.warnings.length} warning(s):`);
    result.warnings.forEach(w => {
      parts.push(`  • ${w.path}: ${w.message}`);
    });
  }

  return parts.join('\n');
}
