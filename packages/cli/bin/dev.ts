#!/usr/bin/env -S bun

import { execute } from "@oclif/core";

await execute({ development: true, dir: import.meta.url });
