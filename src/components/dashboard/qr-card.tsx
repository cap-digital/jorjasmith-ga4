"use client";

import { QrCode, ScanLine, Smartphone } from "lucide-react";
import { motion } from "motion/react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Ga4QrMetrics, Ga4QrRow } from "@/lib/ga4-types";
import { formatCurrency, formatInteger, formatPercent } from "@/lib/format";

import { fadeUp } from "./motion";

/** "2026-10-07T15" → "07/10 às 15h" (year added when it isn't the current one). */
function formatLastSeen(lastSeen: string): string {
  const [date, hour] = lastSeen.split("T");
  const [year, month, day] = date.split("-");
  const sameYear = Number(year) === new Date().getFullYear();
  return `${day}/${month}${sameYear ? "" : `/${year}`} às ${Number(hour)}h`;
}

function Stat({ label, value, hint, lead = false }: { label: string; value: string; hint?: string; lead?: boolean }) {
  return (
    <div className="grid content-start gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`font-semibold tracking-tight ${lead ? "text-3xl" : "text-xl"}`}>{value}</span>
      {hint && <span className="text-xs text-muted-foreground tabular-nums">{hint}</span>}
    </div>
  );
}

const share = (part: number, whole: number) => (whole > 0 ? formatPercent(part / whole) : "—");

export function QrCard({
  qr,
  currency,
}: {
  qr: { totals: Ga4QrMetrics; rows: Ga4QrRow[]; lastSeen: string | null } | null;
  currency: string;
}) {
  const totals = qr?.totals;
  const desktopSessions = totals ? totals.sessions - totals.mobileSessions : 0;

  return (
    <motion.div variants={fadeUp}>
      <Card className="relative overflow-hidden bg-linear-to-br from-chart-1/12 via-card to-card ring-chart-1/45">
        {/* Accent rail on the left edge marks this card as the featured one. */}
        <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-chart-1" />
        <CardContent className="flex flex-col gap-5 pl-5 sm:pl-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-chart-1/15 text-chart-1 ring-1 ring-chart-1/30">
                <QrCode className="size-5" aria-hidden />
              </span>
              <div className="grid gap-1">
                <h2 className="text-base font-semibold leading-snug">QR codes · Jorja Smith</h2>
                <p className="text-sm text-muted-foreground">
                  Mídia da sessão <code className="text-foreground/80">qr-code</code> /{" "}
                  <code className="text-foreground/80">qrcode</code> em campanhas ou na página da Jorja Smith
                </p>
              </div>
            </div>
            {qr?.lastSeen && (
              <div className="flex items-center gap-2 rounded-full bg-chart-1/10 px-3 py-1 text-xs ring-1 ring-chart-1/25">
                <ScanLine className="size-3.5 text-chart-1" aria-hidden />
                <span className="text-muted-foreground">Última leitura</span>
                <span className="font-medium tabular-nums">{formatLastSeen(qr.lastSeen)}</span>
              </div>
            )}
          </div>

          {totals ? (
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4 lg:grid-cols-7">
              <Stat lead label="Leituras (sessões)" value={formatInteger(totals.sessions)} />
              <Stat
                label="Pelo celular"
                value={formatInteger(totals.mobileSessions)}
                hint={`${share(totals.mobileSessions, totals.sessions)} das leituras`}
              />
              <Stat label="Usuários" value={formatInteger(totals.users)} />
              <Stat label="Novos usuários" value={formatInteger(totals.newUsers)} />
              <Stat label="Adições ao carrinho" value={formatInteger(totals.itemsAddedToCart)} />
              <Stat label="Ingressos vendidos" value={formatInteger(totals.itemsPurchased)} />
              <Stat label="Receita" value={formatCurrency(totals.itemRevenue, currency)} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
              {Array.from({ length: 7 }, (_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          )}

          {qr && qr.rows.length === 0 && (
            <div className="flex items-center gap-3 rounded-lg border border-dashed border-chart-1/30 px-4 py-5 text-sm">
              <QrCode className="size-5 shrink-0 text-chart-1/70" aria-hidden />
              <div className="grid gap-0.5">
                <span className="font-medium">Nenhuma leitura de QR code da Jorja Smith no período</span>
                <span className="text-muted-foreground">
                  Contam links com <code>utm_medium</code> (ou <code>utm_source</code>) <code>qr-code</code> /{" "}
                  <code>qrcode</code> e campanha com “jorja”.
                </span>
              </div>
            </div>
          )}

          {qr && qr.rows.length > 0 && totals && (
            <div className="-mx-2 rounded-lg bg-background/40 ring-1 ring-foreground/5">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs text-muted-foreground">Local (utm_source)</TableHead>
                    <TableHead className="hidden text-xs text-muted-foreground sm:table-cell">Mídia</TableHead>
                    <TableHead className="hidden text-xs text-muted-foreground md:table-cell">Campanha</TableHead>
                    <TableHead className="text-right text-xs text-muted-foreground">Leituras</TableHead>
                    <TableHead className="hidden text-right text-xs text-muted-foreground sm:table-cell">Celular</TableHead>
                    <TableHead className="hidden text-right text-xs text-muted-foreground lg:table-cell">Usuários</TableHead>
                    <TableHead className="hidden text-right text-xs text-muted-foreground lg:table-cell">Engajamento</TableHead>
                    <TableHead className="hidden text-right text-xs text-muted-foreground md:table-cell">Carrinho</TableHead>
                    <TableHead className="hidden text-right text-xs text-muted-foreground md:table-cell">Comprados</TableHead>
                    <TableHead className="hidden text-right text-xs text-muted-foreground sm:table-cell">Receita</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {qr.rows.map((row) => (
                    <TableRow key={`${row.source}|${row.medium}|${row.campaign}`}>
                      <TableCell>
                        <span className="flex items-center gap-2 font-medium">
                          <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-chart-1" />
                          {row.source || "(sem origem)"}
                        </span>
                        <span className="block pl-3.5 text-xs text-muted-foreground md:hidden">
                          {row.medium} · {row.campaign || "(sem campanha)"} · {formatInteger(row.itemsPurchased)} comprados
                        </span>
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground sm:table-cell">{row.medium}</TableCell>
                      <TableCell className="hidden max-w-56 truncate text-muted-foreground md:table-cell" title={row.campaign}>
                        {row.campaign || "(sem campanha)"}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{formatInteger(row.sessions)}</TableCell>
                      <TableCell className="hidden text-right tabular-nums sm:table-cell">
                        <span className="inline-flex items-center gap-1">
                          <Smartphone className="size-3 text-muted-foreground" aria-hidden />
                          {formatInteger(row.mobileSessions)}
                        </span>
                      </TableCell>
                      <TableCell className="hidden text-right tabular-nums lg:table-cell">{formatInteger(row.users)}</TableCell>
                      <TableCell className="hidden text-right tabular-nums lg:table-cell">
                        {share(row.engagedSessions, row.sessions)}
                      </TableCell>
                      <TableCell className="hidden text-right tabular-nums md:table-cell">
                        {formatInteger(row.itemsAddedToCart)}
                      </TableCell>
                      <TableCell className="hidden text-right tabular-nums md:table-cell">
                        {formatInteger(row.itemsPurchased)}
                      </TableCell>
                      <TableCell className="hidden text-right tabular-nums sm:table-cell">
                        {formatCurrency(row.itemRevenue, currency)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                {qr.rows.length > 1 && (
                  <TableFooter className="bg-transparent">
                    <TableRow className="hover:bg-transparent">
                      <TableCell className="font-medium">Total</TableCell>
                      <TableCell className="hidden sm:table-cell" />
                      <TableCell className="hidden md:table-cell" />
                      <TableCell className="text-right font-medium tabular-nums">{formatInteger(totals.sessions)}</TableCell>
                      <TableCell className="hidden text-right font-medium tabular-nums sm:table-cell">
                        {formatInteger(totals.mobileSessions)}
                      </TableCell>
                      <TableCell className="hidden text-right font-medium tabular-nums lg:table-cell">
                        {formatInteger(totals.users)}
                      </TableCell>
                      <TableCell className="hidden text-right font-medium tabular-nums lg:table-cell">
                        {share(totals.engagedSessions, totals.sessions)}
                      </TableCell>
                      <TableCell className="hidden text-right font-medium tabular-nums md:table-cell">
                        {formatInteger(totals.itemsAddedToCart)}
                      </TableCell>
                      <TableCell className="hidden text-right font-medium tabular-nums md:table-cell">
                        {formatInteger(totals.itemsPurchased)}
                      </TableCell>
                      <TableCell className="hidden text-right font-medium tabular-nums sm:table-cell">
                        {formatCurrency(totals.itemRevenue, currency)}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </div>
          )}

          {desktopSessions > 0 && (
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <Smartphone className="mt-px size-3.5 shrink-0" aria-hidden />
              QR codes são lidos no celular: {formatInteger(desktopSessions)}{" "}
              {desktopSessions === 1 ? "acesso pelo computador costuma" : "acessos pelo computador costumam"} ser teste
              do link.
            </p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
