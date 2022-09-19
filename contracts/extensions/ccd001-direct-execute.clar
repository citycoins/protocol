;; Title: CCD001 Direct Execute
;; Synopsis:
;; This extension allows a small number of very trusted principals to immediately
;; execute a proposal once a super majority is reached.
;; Description:
;; An extension meant for the bootstrapping period of a DAO. It temporarily gives
;; trusted principals the ability to perform an "executive action"; meaning, they
;; can skip the voting process to immediately execute a proposal.
;; The Direct Execute extension is set with a sunset period of ~6 months from
;; deployment. Executive Team members, the parameters, and sunset period may be changed
;; by means of a future proposal.

;; TRAITS

(impl-trait .extension-trait.extension-trait)
(use-trait proposal-trait .proposal-trait.proposal-trait)

;; CONSTANTS

(define-constant ERR_UNAUTHORIZED (err u3000))
(define-constant ERR_NOT_EXECUTIVE_TEAM_MEMBER (err u3001))
(define-constant ERR_ALREADY_EXECUTED (err u3002))
(define-constant ERR_SUNSET_HEIGHT_REACHED (err u3003))
(define-constant ERR_SUNSET_HEIGHT_IN_PAST (err u3004))

;; DATA MAPS AND VARS

;; ~6 months from deployment
(define-data-var executiveTeamSunsetHeight uint (+ block-height u25920))
;; signals required for an executive action.
(define-data-var executiveSignalsRequired uint u1)

(define-map ExecutiveTeam principal bool)
(define-map ExecutiveActionSignals {proposal: principal, team-member: principal} bool)
(define-map ExecutiveActionSignalCount principal uint)

;; Authorization Check

(define-public (is-dao-or-extension)
  (ok (asserts!
    (or
      (is-eq tx-sender .base-dao)
      (contract-call? .base-dao is-extension contract-caller))
    ERR_UNAUTHORIZED
  ))
)

;; Internal DAO functions

(define-public (set-executive-team-sunset-height (height uint))
  (begin
    (try! (is-dao-or-extension))
    (asserts! (> height block-height) ERR_SUNSET_HEIGHT_IN_PAST)
    (ok (var-set executiveTeamSunsetHeight height))
  )
)

(define-public (set-executive-team-member (who principal) (member bool))
  (begin
    (try! (is-dao-or-extension))
    (ok (map-set ExecutiveTeam who member))
  )
)

(define-public (set-signals-required (new-requirement uint))
  (begin
    (try! (is-dao-or-extension))
    (ok (var-set executiveSignalsRequired new-requirement))
  )
)

;; Public Functions

(define-read-only (is-executive-team-member (who principal))
  (default-to false (map-get? ExecutiveTeam who))
)

(define-read-only (has-signalled (proposal principal) (who principal))
  (default-to false (map-get? ExecutiveActionSignals {proposal: proposal, team-member: who}))
)

(define-read-only (get-signals-required)
  (var-get executiveSignalsRequired)
)

(define-read-only (get-signals (proposal principal))
  (default-to u0 (map-get? ExecutiveActionSignalCount proposal))
)

(define-public (executive-action (proposal <proposal-trait>))
  (let
    (
      (proposal-principal (contract-of proposal))
      (signals (+ (get-signals proposal-principal) (if (has-signalled proposal-principal tx-sender) u0 u1)))
    )
    (asserts! (is-executive-team-member tx-sender) ERR_NOT_EXECUTIVE_TEAM_MEMBER)
    (asserts! (< block-height (var-get executiveTeamSunsetHeight)) ERR_SUNSET_HEIGHT_REACHED)
    (and (>= signals (var-get executiveSignalsRequired))
      (try! (contract-call? .base-dao execute proposal tx-sender))
    )
    (map-set ExecutiveActionSignals {proposal: proposal-principal, team-member: tx-sender} true)
    (map-set ExecutiveActionSignalCount proposal-principal signals)
    (ok signals)
  )
)

;; Extension callback

(define-public (callback (sender principal) (memo (buff 34)))
  (ok true)
)
