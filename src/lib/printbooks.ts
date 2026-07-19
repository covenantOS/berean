"use client";

import { collection, type Record_ } from "./store";

/**
 * Print books: the physical shelf, registered so a search can name a work
 * the reader owns on paper and say where it sits. No body is stored; the
 * text lives on the reader's shelf, not the device, so a Docs Search hit
 * names the book and its location note and offers no digital target. An
 * ISBN is cataloguing only, recorded as given. Page-number citation does
 * not ship: no citation workflow here tracks pages. The sync envelope rides
 * along from day one as everywhere.
 */

export interface PrintBook extends Record_ {
  title: string;
  author?: string;
  /** The edition's ISBN, recorded as given; cataloguing only. */
  isbn?: string;
  /** Where the physical copy lives: a shelf note. */
  location?: string;
  notes?: string;
}

export const printbooks = collection<PrintBook>("berean.printbooks.v1");
