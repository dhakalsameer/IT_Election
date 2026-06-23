// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "forge-std/Test.sol";
import "../src/Election1.sol";

contract Election1Test is Test {

    Election1 election;

    address student1 = address(2);
    address student2 = address(3);
    address admin;

    uint256 registrationStart;
    uint256 registrationEnd;
    uint256 votingStart;
    uint256 votingEnd;

    function setUp() public {
        election = new Election1();
        admin = election.admin();

        registrationStart = block.timestamp;
        registrationEnd = block.timestamp + 2 hours;
        votingStart = registrationEnd + 1 hours;
        votingEnd = votingStart + 8 hours;
    }

    function _candidateInput(string memory guid, address wallet)
        internal
        pure
        returns (Election1.CandidateInput memory)
    {
        return Election1.CandidateInput({guid: guid, wallet: wallet});
    }

    function _buildInputs(uint256 count, string memory prefix)
        internal
        view
        returns (Election1.CandidateInput[] memory inputs)
    {
        inputs = new Election1.CandidateInput[](count);

        for (uint256 i = 0; i < count; i++) {
            inputs[i] = _candidateInput(
                string(abi.encodePacked(prefix, vm.toString(i))),
                address(uint160(100 + i))
            );
        }
    }

    function _startRegistration() internal {
        election.startRegistration(registrationStart, registrationEnd);
        vm.warp(registrationStart);
    }

    function _registerAllCandidates() internal {
        election.registerPresidentCandidates(_buildInputs(2, "GU-P"));
        election.registerSecretaryCandidates(_buildInputs(2, "GU-S"));
        election.registerGeneralMembers(_buildInputs(10, "GU-M"));
    }

    function _verifyStudent(address student) internal {
        address[] memory voters = new address[](1);
        voters[0] = student;
        election.verifyVoters(voters);
    }

    function _startVotingPhase() internal {
        vm.warp(registrationEnd + 1);
        election.startElection(votingStart, votingEnd);
    }

    function _memberBallot() internal pure returns (uint256[] memory members) {
        members = new uint256[](7);
        for (uint256 i = 0; i < 7; i++) {
            members[i] = i + 5;
        }
    }

    function testBatchPresidentRegistration() public {
        vm.startPrank(admin);
        _startRegistration();

        Election1.CandidateInput[] memory presidents = _buildInputs(3, "GU-P");
        election.registerPresidentCandidates(presidents);
        vm.stopPrank();

        assertEq(election.presidentCount(), 3);
        assertEq(election.candidateCount(), 3);

        Election1.Candidate memory first = election.getCandidate(1);
        assertEq(first.guid, "GU-P0");
        assertEq(uint256(first.position), uint256(Election1.Position.President));
        assertTrue(first.exists);
    }

    function testBatchRegistrationByPosition() public {
        vm.startPrank(admin);
        _startRegistration();
        _registerAllCandidates();
        vm.stopPrank();

        assertEq(election.presidentCount(), 2);
        assertEq(election.secretaryCount(), 2);
        assertEq(election.generalMemberCount(), 10);
        assertEq(election.candidateCount(), 14);
    }

    function testRejectDuplicateGuid() public {
        vm.startPrank(admin);
        _startRegistration();

        Election1.CandidateInput[] memory presidents = new Election1.CandidateInput[](2);
        presidents[0] = _candidateInput("GU-001", address(10));
        presidents[1] = _candidateInput("GU-001", address(11));

        vm.expectRevert("GUID already registered");
        election.registerPresidentCandidates(presidents);

        vm.stopPrank();
    }

    function testCannotRegisterCandidatesWithoutStartRegistration() public {
        vm.prank(admin);
        vm.expectRevert("Wrong state");
        election.registerPresidentCandidates(_buildInputs(1, "GU-P"));
    }

    function testCannotRegisterBeforeRegistrationStart() public {
        registrationStart = block.timestamp + 1 hours;
        registrationEnd = registrationStart + 2 hours;

        vm.startPrank(admin);
        election.startRegistration(registrationStart, registrationEnd);

        vm.expectRevert("Registration not started");
        election.registerPresidentCandidates(_buildInputs(1, "GU-P"));
        vm.stopPrank();
    }

    function testCannotRegisterAfterRegistrationEnd() public {
        vm.startPrank(admin);
        _startRegistration();
        vm.warp(registrationEnd + 1);

        vm.expectRevert("Registration ended");
        election.registerPresidentCandidates(_buildInputs(1, "GU-P"));
        vm.stopPrank();
    }

    function testCannotStartElectionWhileRegistrationOpen() public {
        vm.startPrank(admin);
        _startRegistration();
        _registerAllCandidates();

        vm.expectRevert("Registration still open");
        election.startElection(votingStart, votingEnd);
        vm.stopPrank();
    }

    function testBatchVerifyVotersBeforeElection() public {
        vm.startPrank(admin);
        _startRegistration();

        address[] memory voters = new address[](2);
        voters[0] = student1;
        voters[1] = student2;
        election.verifyVoters(voters);

        assertTrue(election.isVerified(student1));
        assertTrue(election.isVerified(student2));
        assertFalse(election.verificationLocked());
        vm.stopPrank();
    }

    function testCannotVerifyAfterElectionStarts() public {
        vm.startPrank(admin);
        _startRegistration();
        _registerAllCandidates();
        _startVotingPhase();

        address[] memory voters = new address[](1);
        voters[0] = student1;

        vm.expectRevert("Verification locked");
        election.verifyVoters(voters);
        vm.stopPrank();
    }

    function testAdminCanRevokeVoterBeforeElection() public {
        vm.startPrank(admin);
        _startRegistration();
        _verifyStudent(student1);

        election.revokeVoter(student1);

        assertFalse(election.isVerified(student1));
        vm.stopPrank();
    }

    function testCannotRevokeAfterElectionStarts() public {
        vm.startPrank(admin);
        _startRegistration();
        _registerAllCandidates();
        _verifyStudent(student1);
        _startVotingPhase();

        vm.expectRevert("Verification locked");
        election.revokeVoter(student1);
        vm.stopPrank();
    }

    function testVerifiedVoterCanVote() public {
        vm.startPrank(admin);
        _startRegistration();
        _registerAllCandidates();
        _verifyStudent(student1);
        _startVotingPhase();
        vm.stopPrank();

        vm.warp(votingStart);

        vm.prank(student1);
        election.vote(1, 3, _memberBallot());

        assertTrue(election.hasVoted(student1));

        Election1.Candidate memory president = election.getCandidate(1);
        assertEq(president.voteCount, 1);
    }

    function testUnverifiedVoterCannotVote() public {
        vm.startPrank(admin);
        _startRegistration();
        _registerAllCandidates();
        _startVotingPhase();
        vm.stopPrank();

        vm.warp(votingStart);

        vm.prank(student1);
        vm.expectRevert("Not verified");
        election.vote(1, 3, _memberBallot());
    }

    function testCannotVoteBeforeStartTime() public {
        vm.startPrank(admin);
        _startRegistration();
        _registerAllCandidates();
        _verifyStudent(student1);
        _startVotingPhase();
        vm.stopPrank();

        vm.warp(votingStart - 1);

        vm.prank(student1);
        vm.expectRevert("Voting not started");
        election.vote(1, 3, _memberBallot());
    }

    function testCannotVoteAfterEndTime() public {
        vm.startPrank(admin);
        _startRegistration();
        _registerAllCandidates();
        _verifyStudent(student1);
        _startVotingPhase();
        vm.stopPrank();

        vm.warp(votingEnd + 1);

        vm.prank(student1);
        vm.expectRevert("Voting ended");
        election.vote(1, 3, _memberBallot());
    }

    function testCannotVoteTwice() public {
        vm.startPrank(admin);
        _startRegistration();
        _registerAllCandidates();
        _verifyStudent(student1);
        _startVotingPhase();
        vm.stopPrank();

        vm.warp(votingStart);

        vm.startPrank(student1);
        election.vote(1, 3, _memberBallot());

        vm.expectRevert("Already voted");
        election.vote(1, 3, _memberBallot());
        vm.stopPrank();
    }

    function testFinalizeElectionAfterEndTime() public {
        vm.startPrank(admin);
        _startRegistration();
        _registerAllCandidates();
        _verifyStudent(student1);
        _startVotingPhase();
        vm.stopPrank();

        vm.warp(votingStart);

        vm.prank(student1);
        election.vote(1, 3, _memberBallot());

        vm.warp(votingEnd + 1);

        vm.prank(admin);
        election.finalizeElection();

        assertTrue(election.resultsFinalized());
        assertEq(uint256(election.electionState()), uint256(Election1.ElectionState.Ended));
        assertEq(election.presidentWinnerId(), 1);
        assertEq(election.secretaryWinnerId(), 3);
        assertEq(election.generalMemberWinnerIds(0), 5);
    }

    function testCannotFinalizeBeforeEndTime() public {
        vm.startPrank(admin);
        _startRegistration();
        _registerAllCandidates();
        _verifyStudent(student1);
        _startVotingPhase();
        vm.stopPrank();

        vm.warp(votingStart);

        vm.prank(admin);
        vm.expectRevert("Voting still open");
        election.finalizeElection();
    }
}
