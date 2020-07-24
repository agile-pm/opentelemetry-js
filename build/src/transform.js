"use strict";
/*
 * Copyright The OpenTelemetry Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.spanToThrift = void 0;
const api_1 = require("@opentelemetry/api");
const core_1 = require("@opentelemetry/core");
const types_1 = require("./types");
const DEFAULT_FLAGS = 0x1;
/**
 * Translate OpenTelemetry ReadableSpan to Jaeger Thrift Span
 * @param span Span to be translated
 */
function spanToThrift(span) {
    const traceId = span.spanContext.traceId.padStart(32, '0');
    const traceIdHigh = traceId.slice(0, 16);
    const traceIdLow = traceId.slice(16);
    const parentSpan = span.parentSpanId
        ? types_1.Utils.encodeInt64(span.parentSpanId)
        : types_1.ThriftUtils.emptyBuffer;
    const tags = Object.keys(span.attributes).map((name) => ({ key: name, value: toTagValue(span.attributes[name]) }));
    tags.push({ key: 'status.code', value: span.status.code });
    tags.push({ key: 'status.name', value: api_1.CanonicalCode[span.status.code] });
    if (span.status.message) {
        tags.push({ key: 'status.message', value: span.status.message });
    }
    // Ensure that if Status.Code is not OK, that we set the "error" tag on the
    // Jaeger span.
    if (span.status.code !== api_1.CanonicalCode.OK) {
        tags.push({ key: 'error', value: true });
    }
    if (span.kind !== undefined) {
        tags.push({ key: 'span.kind', value: api_1.SpanKind[span.kind] });
    }
    Object.keys(span.resource.labels).forEach(name => tags.push({
        key: name,
        value: toTagValue(span.resource.labels[name]),
    }));
    const spanTags = types_1.ThriftUtils.getThriftTags(tags);
    const logs = span.events.map((event) => {
        const fields = [{ key: 'message.id', value: event.name }];
        const attrs = event.attributes;
        if (attrs) {
            Object.keys(attrs).forEach(attr => fields.push({ key: attr, value: toTagValue(attrs[attr]) }));
        }
        return { timestamp: core_1.hrTimeToMilliseconds(event.time), fields };
    });
    const spanLogs = types_1.ThriftUtils.getThriftLogs(logs);
    return {
        traceIdLow: types_1.Utils.encodeInt64(traceIdLow),
        traceIdHigh: types_1.Utils.encodeInt64(traceIdHigh),
        spanId: types_1.Utils.encodeInt64(span.spanContext.spanId),
        parentSpanId: parentSpan,
        operationName: span.name,
        references: spanLinksToThriftRefs(span.links, span.parentSpanId),
        flags: span.spanContext.traceFlags || DEFAULT_FLAGS,
        startTime: types_1.Utils.encodeInt64(core_1.hrTimeToMicroseconds(span.startTime)),
        duration: types_1.Utils.encodeInt64(core_1.hrTimeToMicroseconds(span.duration)),
        tags: spanTags,
        logs: spanLogs,
    };
}
exports.spanToThrift = spanToThrift;
/** Translate OpenTelemetry {@link Link}s to Jaeger ThriftReference. */
function spanLinksToThriftRefs(links, parentSpanId) {
    return links
        .map((link) => {
        if (link.context.spanId === parentSpanId) {
            const refType = types_1.ThriftReferenceType.CHILD_OF;
            const traceId = link.context.traceId;
            const traceIdHigh = types_1.Utils.encodeInt64(traceId.slice(0, 16));
            const traceIdLow = types_1.Utils.encodeInt64(traceId.slice(16));
            const spanId = types_1.Utils.encodeInt64(link.context.spanId);
            return { traceIdLow, traceIdHigh, spanId, refType };
        }
        return null;
    })
        .filter(ref => !!ref);
}
/** Translate OpenTelemetry attribute value to Jaeger TagValue. */
function toTagValue(value) {
    const valueType = typeof value;
    if (valueType === 'boolean') {
        return value;
    }
    else if (valueType === 'number') {
        return value;
    }
    return String(value);
}
//# sourceMappingURL=transform.js.map