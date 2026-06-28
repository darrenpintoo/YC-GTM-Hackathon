/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as contracts from "../contracts.js";
import type * as enrich from "../enrich.js";
import type * as events from "../events.js";
import type * as ingest from "../ingest.js";
import type * as lib_attendeeConnection from "../lib/attendeeConnection.js";
import type * as lib_csvParse from "../lib/csvParse.js";
import type * as lib_defaults from "../lib/defaults.js";
import type * as lib_demoSeed from "../lib/demoSeed.js";
import type * as lib_extractHeuristic from "../lib/extractHeuristic.js";
import type * as lib_fetchSource from "../lib/fetchSource.js";
import type * as lib_fetchSourceCached from "../lib/fetchSourceCached.js";
import type * as lib_fiber from "../lib/fiber.js";
import type * as lib_firecrawl from "../lib/firecrawl.js";
import type * as lib_jobs from "../lib/jobs.js";
import type * as lib_matching from "../lib/matching.js";
import type * as lib_normalize from "../lib/normalize.js";
import type * as lib_openai from "../lib/openai.js";
import type * as lib_plainFetch from "../lib/plainFetch.js";
import type * as lib_profileHeuristic from "../lib/profileHeuristic.js";
import type * as lib_scrapeCache from "../lib/scrapeCache.js";
import type * as lib_slugify from "../lib/slugify.js";
import type * as lib_sourceQuality from "../lib/sourceQuality.js";
import type * as lib_sourceRank from "../lib/sourceRank.js";
import type * as lib_underwriting from "../lib/underwriting.js";
import type * as lib_validators from "../lib/validators.js";
import type * as matcher from "../matcher.js";
import type * as memo from "../memo.js";
import type * as orchestrate from "../orchestrate.js";
import type * as pipeline from "../pipeline.js";
import type * as profile from "../profile.js";
import type * as research from "../research.js";
import type * as scrapeCache from "../scrapeCache.js";
import type * as underwrite from "../underwrite.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  contracts: typeof contracts;
  enrich: typeof enrich;
  events: typeof events;
  ingest: typeof ingest;
  "lib/attendeeConnection": typeof lib_attendeeConnection;
  "lib/csvParse": typeof lib_csvParse;
  "lib/defaults": typeof lib_defaults;
  "lib/demoSeed": typeof lib_demoSeed;
  "lib/extractHeuristic": typeof lib_extractHeuristic;
  "lib/fetchSource": typeof lib_fetchSource;
  "lib/fetchSourceCached": typeof lib_fetchSourceCached;
  "lib/fiber": typeof lib_fiber;
  "lib/firecrawl": typeof lib_firecrawl;
  "lib/jobs": typeof lib_jobs;
  "lib/matching": typeof lib_matching;
  "lib/normalize": typeof lib_normalize;
  "lib/openai": typeof lib_openai;
  "lib/plainFetch": typeof lib_plainFetch;
  "lib/profileHeuristic": typeof lib_profileHeuristic;
  "lib/scrapeCache": typeof lib_scrapeCache;
  "lib/slugify": typeof lib_slugify;
  "lib/sourceQuality": typeof lib_sourceQuality;
  "lib/sourceRank": typeof lib_sourceRank;
  "lib/underwriting": typeof lib_underwriting;
  "lib/validators": typeof lib_validators;
  matcher: typeof matcher;
  memo: typeof memo;
  orchestrate: typeof orchestrate;
  pipeline: typeof pipeline;
  profile: typeof profile;
  research: typeof research;
  scrapeCache: typeof scrapeCache;
  underwrite: typeof underwrite;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
