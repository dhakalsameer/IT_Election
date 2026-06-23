// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @title Election1
/// @notice Production-oriented election contract for IT Club.
///         Student profiles stay in PostgreSQL; the chain stores election state,
///         candidates (GUID + wallet), votes, and results.
contract Election1 {

    uint256 public constant GENERAL_MEMBERS_ELECTED = 7;

    // ======================
    // ENUMS
    // ======================
    enum ElectionState {
        Draft,
        Registration,
        Voting,
        Ended
    }

    enum Position {
        President,
        Secretary,
        GeneralMember
    }

    // ======================
    // STRUCTS
    // ======================
    struct CandidateInput {
        string guid;
        address wallet;
    }

    struct Candidate {
        uint256 id;
        string guid;
        address wallet;
        Position position;
        uint256 voteCount;
        bool exists;
    }

    // ======================
    // STATE
    // ======================
    address public admin;
    ElectionState public electionState;

    uint256 public candidateCount;

    uint256 public registrationStartTime;
    uint256 public registrationEndTime;

    uint256 public votingStartTime;
    uint256 public votingEndTime;

    bool public resultsFinalized;

    uint256 public presidentWinnerId;
    uint256 public secretaryWinnerId;
    uint256[GENERAL_MEMBERS_ELECTED] public generalMemberWinnerIds;

    mapping(uint256 => Candidate) public candidates;
    mapping(address => bool) public verifiedVoters;
    mapping(address => bool) public hasVoted;
    mapping(string => bool) private guidRegistered;

    bool public verificationLocked;

    uint256 public presidentCount;
    uint256 public secretaryCount;
    uint256 public generalMemberCount;

    // ======================
    // EVENTS
    // ======================
    event RegistrationStarted(uint256 registrationStartTime, uint256 registrationEndTime);
    event VotersVerified(address[] voters);
    event VoterRevoked(address indexed voter);
    event VerificationLocked();
    event CandidateRegistered(uint256 indexed id, string guid, Position position);
    event CandidatesBatchRegistered(Position position, uint256 count);
    event VoteCast(address indexed voter, uint256 presidentId, uint256 secretaryId, uint256[] memberIds);
    event ElectionStarted(uint256 votingStartTime, uint256 votingEndTime);
    event ElectionFinalized(
        uint256 presidentWinnerId,
        uint256 secretaryWinnerId,
        uint256[] generalMemberWinnerIds
    );
    event VoteUpdated(uint256 candidateId, uint256 newVoteCount);

    // ======================
    // MODIFIERS
    // ======================
    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }

    modifier inState(ElectionState _state) {
        require(electionState == _state, "Wrong state");
        _;
    }

    modifier inRegistrationTime() {
        require(block.timestamp >= registrationStartTime, "Registration not started");
        require(block.timestamp <= registrationEndTime, "Registration ended");
        _;
    }

    modifier onlyDuringVoting() {
        require(block.timestamp >= votingStartTime, "Voting not started");
        require(block.timestamp <= votingEndTime, "Voting ended");
        _;
    }

    modifier verificationOpen() {
        require(!verificationLocked, "Verification locked");
        require(electionState == ElectionState.Registration, "Wrong state");
        _;
    }

    // ======================
    // CONSTRUCTOR
    // ======================
    constructor() {
        admin = msg.sender;
        electionState = ElectionState.Draft;
    }

    // ======================
    // ADMIN: ELECTION LIFECYCLE
    // ======================
    function startRegistration(uint256 _startTime, uint256 _endTime)
        external
        onlyAdmin
        inState(ElectionState.Draft)
    {
        require(_endTime > _startTime, "Invalid time range");
        require(_endTime > block.timestamp, "End time must be in future");

        registrationStartTime = _startTime;
        registrationEndTime = _endTime;
        electionState = ElectionState.Registration;

        emit RegistrationStarted(registrationStartTime, registrationEndTime);
    }

    function startElection(uint256 _startTime, uint256 _endTime)
        external
        onlyAdmin
        inState(ElectionState.Registration)
    {
        require(_endTime > _startTime, "Invalid time range");
        require(_endTime > block.timestamp, "End time must be in future");
        require(block.timestamp > registrationEndTime, "Registration still open");
        require(_startTime >= registrationEndTime, "Voting must start after registration");

        verificationLocked = true;
        electionState = ElectionState.Voting;
        votingStartTime = _startTime;
        votingEndTime = _endTime;

        emit VerificationLocked();
        emit ElectionStarted(votingStartTime, votingEndTime);
    }

    function finalizeElection() external onlyAdmin inState(ElectionState.Voting) {
        require(block.timestamp > votingEndTime, "Voting still open");
        require(!resultsFinalized, "Already finalized");

        presidentWinnerId = _findWinner(Position.President);
        secretaryWinnerId = _findWinner(Position.Secretary);
        _selectTopGeneralMembers();

        resultsFinalized = true;
        electionState = ElectionState.Ended;

        uint256[] memory memberWinners = new uint256[](GENERAL_MEMBERS_ELECTED);
        for (uint256 i = 0; i < GENERAL_MEMBERS_ELECTED; i++) {
            memberWinners[i] = generalMemberWinnerIds[i];
        }

        emit ElectionFinalized(presidentWinnerId, secretaryWinnerId, memberWinners);
    }

    // ======================
    // ADMIN: VOTER VERIFICATION (BEFORE ELECTION START)
    // ======================
    function verifyVoters(address[] calldata voters) external onlyAdmin verificationOpen {
        require(voters.length > 0, "No voters");

        for (uint256 i = 0; i < voters.length; i++) {
            address voter = voters[i];
            require(voter != address(0), "Invalid address");
            verifiedVoters[voter] = true;
        }

        emit VotersVerified(voters);
    }

    function revokeVoter(address voter) external onlyAdmin verificationOpen {
        require(voter != address(0), "Invalid address");

        verifiedVoters[voter] = false;

        emit VoterRevoked(voter);
    }

    // ======================
    // ADMIN: BATCH CANDIDATE REGISTRATION
    // ======================
    function registerPresidentCandidates(CandidateInput[] calldata inputs)
        external
        onlyAdmin
        inState(ElectionState.Registration)
        inRegistrationTime
    {
        _registerCandidates(inputs, Position.President);
    }

    function registerSecretaryCandidates(CandidateInput[] calldata inputs)
        external
        onlyAdmin
        inState(ElectionState.Registration)
        inRegistrationTime
    {
        _registerCandidates(inputs, Position.Secretary);
    }

    function registerGeneralMembers(CandidateInput[] calldata inputs)
        external
        onlyAdmin
        inState(ElectionState.Registration)
        inRegistrationTime
    {
        _registerCandidates(inputs, Position.GeneralMember);
    }

    function _registerCandidates(CandidateInput[] calldata inputs, Position position) private {
        require(inputs.length > 0, "No candidates");

        for (uint256 i = 0; i < inputs.length; i++) {
            CandidateInput calldata input = inputs[i];

            require(bytes(input.guid).length > 0, "Empty GUID");
            require(!guidRegistered[input.guid], "GUID already registered");

            candidateCount++;
            guidRegistered[input.guid] = true;

            if (position == Position.President) {
                presidentCount++;
            } else if (position == Position.Secretary) {
                secretaryCount++;
            } else {
                generalMemberCount++;
            }

            candidates[candidateCount] = Candidate({
                id: candidateCount,
                guid: input.guid,
                wallet: input.wallet,
                position: position,
                voteCount: 0,
                exists: true
            });

            emit CandidateRegistered(candidateCount, input.guid, position);
        }

        emit CandidatesBatchRegistered(position, inputs.length);
    }

    // ======================
    // VOTING
    // ======================
    function vote(
        uint256 _presidentId,
        uint256 _secretaryId,
        uint256[] calldata _memberIds
    )
        external
        inState(ElectionState.Voting)
        onlyDuringVoting
    {
        require(verifiedVoters[msg.sender], "Not verified");
        require(!hasVoted[msg.sender], "Already voted");
        require(_memberIds.length == GENERAL_MEMBERS_ELECTED, "Must select 7 members");

        for (uint256 i = 0; i < _memberIds.length; i++) {
            for (uint256 j = i + 1; j < _memberIds.length; j++) {
                require(_memberIds[i] != _memberIds[j], "Duplicate member vote");
            }
        }

        require(candidates[_presidentId].exists, "Invalid president");
        require(candidates[_presidentId].position == Position.President, "Not president");
        candidates[_presidentId].voteCount++;
        emit VoteUpdated(_presidentId, candidates[_presidentId].voteCount);

        require(candidates[_secretaryId].exists, "Invalid secretary");
        require(candidates[_secretaryId].position == Position.Secretary, "Not secretary");
        candidates[_secretaryId].voteCount++;
        emit VoteUpdated(_secretaryId, candidates[_secretaryId].voteCount);

        for (uint256 i = 0; i < GENERAL_MEMBERS_ELECTED; i++) {
            uint256 id = _memberIds[i];

            require(candidates[id].exists, "Invalid member");
            require(candidates[id].position == Position.GeneralMember, "Not member");

            candidates[id].voteCount++;
            emit VoteUpdated(id, candidates[id].voteCount);
        }

        hasVoted[msg.sender] = true;

        emit VoteCast(msg.sender, _presidentId, _secretaryId, _memberIds);
    }

    // ======================
    // INTERNAL: WINNER SELECTION
    // ======================
    function _findWinner(Position position) private view returns (uint256 winnerId) {
        uint256 maxVotes = 0;

        for (uint256 i = 1; i <= candidateCount; i++) {
            Candidate storage candidate = candidates[i];

            if (!candidate.exists || candidate.position != position) {
                continue;
            }

            if (
                candidate.voteCount > maxVotes
                    || (candidate.voteCount == maxVotes && (winnerId == 0 || candidate.id < winnerId))
            ) {
                maxVotes = candidate.voteCount;
                winnerId = candidate.id;
            }
        }

        require(winnerId != 0, "No candidate for position");
    }

    function _selectTopGeneralMembers() private {
        for (uint256 rank = 0; rank < GENERAL_MEMBERS_ELECTED; rank++) {
            uint256 bestId = 0;
            uint256 bestVotes = 0;

            for (uint256 i = 1; i <= candidateCount; i++) {
                Candidate storage candidate = candidates[i];

                if (!candidate.exists || candidate.position != Position.GeneralMember) {
                    continue;
                }

                if (_isGeneralMemberWinner(candidate.id, rank)) {
                    continue;
                }

                if (
                    candidate.voteCount > bestVotes
                        || (candidate.voteCount == bestVotes && (bestId == 0 || candidate.id < bestId))
                ) {
                    bestVotes = candidate.voteCount;
                    bestId = candidate.id;
                }
            }

            require(bestId != 0, "Not enough general member candidates");
            generalMemberWinnerIds[rank] = bestId;
        }
    }

    function _isGeneralMemberWinner(uint256 candidateId, uint256 upToRank) private view returns (bool) {
        for (uint256 i = 0; i < upToRank; i++) {
            if (generalMemberWinnerIds[i] == candidateId) {
                return true;
            }
        }

        return false;
    }

    // ======================
    // VIEW FUNCTIONS
    // ======================
    function getCandidate(uint256 _id) external view returns (Candidate memory) {
        return candidates[_id];
    }

    function isGuidRegistered(string calldata guid) external view returns (bool) {
        return guidRegistered[guid];
    }

    function isVerified(address voter) external view returns (bool) {
        return verifiedVoters[voter];
    }
}
