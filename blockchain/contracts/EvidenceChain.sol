// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title EvidenceChain
 * @author JusticeVault Team
 * @notice Tamper-proof digital evidence registry & chain-of-custody smart contract.
 * @dev Stores immutable cryptographic SHA-256 digests and records all custodial state transitions.
 */
contract EvidenceChain is Ownable {

    enum CustodyAction {
        REGISTERED,
        ACCESSED,
        TRANSFERRED,
        ANALYZED,
        VERIFIED,
        FLAGGED
    }

    struct EvidenceRecord {
        string evidenceId;
        string caseId;
        bytes32 sha256Hash;
        string ipfsCid;
        address registeredBy;
        uint256 registeredAt;
        bool exists;
    }

    struct CustodyRecord {
        string evidenceId;
        CustodyAction action;
        address actor;
        address fromUser;
        address toUser;
        uint256 timestamp;
        string reason;
    }

    // Storage
    mapping(string => EvidenceRecord) private _evidences;
    mapping(string => CustodyRecord[]) private _custodyHistory;
    mapping(bytes32 => bool) private _registeredHashes;
    mapping(address => bool) public authorizedOperators;

    // Events
    event EvidenceRegistered(
        string indexed evidenceId,
        string indexed caseId,
        bytes32 indexed sha256Hash,
        string ipfsCid,
        address registeredBy,
        uint256 timestamp
    );

    event CustodyEventLogged(
        string indexed evidenceId,
        CustodyAction indexed action,
        address indexed actor,
        address fromUser,
        address toUser,
        uint256 timestamp,
        string reason
    );

    event OperatorUpdated(address indexed operator, bool authorized);

    modifier onlyOperator() {
        require(
            msg.sender == owner() || authorizedOperators[msg.sender],
            "EvidenceChain: Caller is not an authorized operator"
        );
        _;
    }

    constructor() Ownable(msg.sender) {
        authorizedOperators[msg.sender] = true;
        emit OperatorUpdated(msg.sender, true);
    }

    /**
     * @notice Authorize or revoke an operator address (e.g. backend relayer wallet)
     */
    function setOperator(address operator, bool authorized) external onlyOwner {
        require(operator != address(0), "EvidenceChain: Invalid operator address");
        authorizedOperators[operator] = authorized;
        emit OperatorUpdated(operator, authorized);
    }

    /**
     * @notice Register a new digital evidence record with its authoritative SHA-256 hash.
     */
    function registerEvidence(
        string calldata evidenceId,
        string calldata caseId,
        bytes32 sha256Hash,
        string calldata ipfsCid,
        address actorAddress
    ) external onlyOperator returns (bool) {
        require(bytes(evidenceId).length > 0, "EvidenceChain: Empty evidenceId");
        require(bytes(caseId).length > 0, "EvidenceChain: Empty caseId");
        require(sha256Hash != bytes32(0), "EvidenceChain: Invalid zero hash");
        require(!_evidences[evidenceId].exists, "EvidenceChain: Evidence ID already registered");
        require(!_registeredHashes[sha256Hash], "EvidenceChain: SHA-256 hash already registered on-chain");

        address registeredActor = actorAddress != address(0) ? actorAddress : msg.sender;

        _evidences[evidenceId] = EvidenceRecord({
            evidenceId: evidenceId,
            caseId: caseId,
            sha256Hash: sha256Hash,
            ipfsCid: ipfsCid,
            registeredBy: registeredActor,
            registeredAt: block.timestamp,
            exists: true
        });

        _registeredHashes[sha256Hash] = true;

        _custodyHistory[evidenceId].push(CustodyRecord({
            evidenceId: evidenceId,
            action: CustodyAction.REGISTERED,
            actor: registeredActor,
            fromUser: address(0),
            toUser: registeredActor,
            timestamp: block.timestamp,
            reason: "Initial Evidence Registration"
        }));

        emit EvidenceRegistered(evidenceId, caseId, sha256Hash, ipfsCid, registeredActor, block.timestamp);
        emit CustodyEventLogged(
            evidenceId,
            CustodyAction.REGISTERED,
            registeredActor,
            address(0),
            registeredActor,
            block.timestamp,
            "Initial Evidence Registration"
        );

        return true;
    }

    /**
     * @notice Record a custody lifecycle event (Access, Transfer, Analysis, Verification, Flagging).
     */
    function recordCustodyEvent(
        string calldata evidenceId,
        CustodyAction action,
        address actor,
        address fromUser,
        address toUser,
        string calldata reason
    ) external onlyOperator returns (bool) {
        require(_evidences[evidenceId].exists, "EvidenceChain: Evidence does not exist");
        require(bytes(reason).length > 0, "EvidenceChain: Reason is required");

        address eventActor = actor != address(0) ? actor : msg.sender;

        _custodyHistory[evidenceId].push(CustodyRecord({
            evidenceId: evidenceId,
            action: action,
            actor: eventActor,
            fromUser: fromUser,
            toUser: toUser,
            timestamp: block.timestamp,
            reason: reason
        }));

        emit CustodyEventLogged(evidenceId, action, eventActor, fromUser, toUser, block.timestamp, reason);
        return true;
    }

    /**
     * @notice Retrieve an evidence record by ID.
     */
    function getEvidence(string calldata evidenceId) external view returns (
        string memory id,
        string memory caseId,
        bytes32 sha256Hash,
        string memory ipfsCid,
        address registeredBy,
        uint256 registeredAt,
        bool exists
    ) {
        EvidenceRecord memory record = _evidences[evidenceId];
        require(record.exists, "EvidenceChain: Evidence does not exist");
        return (
            record.evidenceId,
            record.caseId,
            record.sha256Hash,
            record.ipfsCid,
            record.registeredBy,
            record.registeredAt,
            record.exists
        );
    }

    /**
     * @notice Cryptographically verify if a test SHA-256 hash matches the on-chain immutable hash.
     */
    function verifyEvidenceHash(string calldata evidenceId, bytes32 testHash) external view returns (bool isMatch) {
        require(_evidences[evidenceId].exists, "EvidenceChain: Evidence does not exist");
        return _evidences[evidenceId].sha256Hash == testHash;
    }

    /**
     * @notice Check if a specific SHA-256 hash already exists in the registry.
     */
    function isHashRegistered(bytes32 sha256Hash) external view returns (bool) {
        return _registeredHashes[sha256Hash];
    }

    /**
     * @notice Get total number of custody records for a specific evidence item.
     */
    function getCustodyHistoryCount(string calldata evidenceId) external view returns (uint256) {
        require(_evidences[evidenceId].exists, "EvidenceChain: Evidence does not exist");
        return _custodyHistory[evidenceId].length;
    }

    /**
     * @notice Get an individual custody record by index.
     */
    function getCustodyRecord(string calldata evidenceId, uint256 index) external view returns (
        CustodyAction action,
        address actor,
        address fromUser,
        address toUser,
        uint256 timestamp,
        string memory reason
    ) {
        require(_evidences[evidenceId].exists, "EvidenceChain: Evidence does not exist");
        require(index < _custodyHistory[evidenceId].length, "EvidenceChain: Index out of bounds");
        CustodyRecord memory rec = _custodyHistory[evidenceId][index];
        return (
            rec.action,
            rec.actor,
            rec.fromUser,
            rec.toUser,
            rec.timestamp,
            rec.reason
        );
    }
}
