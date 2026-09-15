/**
 * pt-BR formatters shared by the city report blocks and renderers (C163).
 * Pure and unit-tested: the PDF and the companion `.md` must read identically.
 */

import { municipalitySignalAgeInDays } from '../../src/utilities/municipality/municipalitySignal.ts'

const integerFormatter = new Intl.NumberFormat('pt-BR')
const decimalFormatters = new Map()

const decimalFormatter = (digits) => {
  const cached = decimalFormatters.get(digits)
  if (cached) return cached
  const formatter = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
  decimalFormatters.set(digits, formatter)
  return formatter
}

const toFinite = (value) => {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export const formatInteger = (value) => {
  const number = toFinite(value)
  return number === null ? '—' : integerFormatter.format(Math.round(number))
}

const formatDecimal = (value, digits = 1) => {
  const number = toFinite(value)
  return number === null ? '—' : decimalFormatter(digits).format(number)
}

export const formatPercent = (ratio, digits = 1) => {
  if (ratio === null || ratio === undefined || !Number.isFinite(Number(ratio))) return '—'
  return `${formatDecimal(Number(ratio) * 100, digits)}%`
}

export const formatMoneyCompact = (value) => {
  const number = toFinite(value)
  if (number === null) return '—'
  if (Math.abs(number) < 1_000_000) {
    const thousands = number / 1000
    return `R$ ${formatDecimal(thousands, Math.abs(thousands) >= 100 ? 0 : 1)} mil`
  }
  const millions = number / 1_000_000
  if (Math.abs(millions) >= 1000) return `R$ ${formatDecimal(millions / 1000)} bi`
  return `R$ ${formatDecimal(millions)} mi`
}

export const formatDateBr = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Bahia' }).format(date)
}

export const formatDateTimeBr = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Bahia',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}

export const formatFreshness = (value, now = new Date()) => {
  const days = municipalitySignalAgeInDays(value, now)
  if (days === null) return 'sem registro'
  if (days <= 0) return 'atualizado hoje'
  if (days === 1) return 'atualizado ontem'
  if (days < 14) return `atualizado há ${days} dias`
  const weeks = Math.floor(days / 7)
  if (weeks < 9) return `atualizado há ${weeks} semanas`
  const months = Math.floor(days / 30)
  return `atualizado há ${months} ${months === 1 ? 'mês' : 'meses'}`
}

export const formatRank = (entry) => {
  if (!entry || !Number.isFinite(Number(entry.rank))) return '—'
  return `${formatInteger(entry.rank)}º de ${formatInteger(entry.totalUnits)}`
}
