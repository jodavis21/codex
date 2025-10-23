using System.Collections;
using System.Collections.Generic;
using UnityEngine;

namespace AquariumDemo
{
    /// <summary>
    /// Simple steering-based controller that allows fish to wander and pursue nearby food pellets.
    /// Attach to each fish prefab root.
    /// </summary>
    [RequireComponent(typeof(Rigidbody))]
    public class FishController : MonoBehaviour
    {
        [Header("Swim Behaviour")]
        [SerializeField, Range(0.1f, 5f)] private float swimSpeed = 1f;
        [SerializeField, Range(10f, 200f)] private float turnSpeed = 80f;
        [SerializeField, Range(0.5f, 5f)] private float wanderRadius = 2f;
        [SerializeField, Range(0.1f, 2f)] private float wanderJitter = 0.3f;
        [SerializeField, Range(0.5f, 5f)] private float wanderRecenterTime = 6f;
        [SerializeField, Range(0f, 0.5f)] private float bobAmplitude = 0.12f;
        [SerializeField, Range(0.05f, 2f)] private float bobSpeed = 0.4f;

        [Header("Food Interaction")]
        [SerializeField, Range(0.5f, 5f)] private float foodDetectionRadius = 1.8f;
        [SerializeField, Range(0.05f, 1f)] private float foodConsumeDistance = 0.15f;
        [SerializeField, Range(0.1f, 5f)] private float pursuitAcceleration = 2f;

        [Header("Visuals")]
        [SerializeField] private Animator animator = null;
        [SerializeField] private string swimSpeedParameter = "SwimSpeed";

        private Rigidbody _body;
        private Vector3 _wanderTarget;
        private Vector3 _bobOffset;
        private float _bobTime;
        private float _lastBobSample;
        private float _recenterTimer;
        private FoodController _currentFood;
        private Coroutine _foodLostRoutine;

        private int _swimSpeedHash;
        private static readonly List<FishController> ActiveFish = new List<FishController>();

        /// <summary>
        /// Provides read-only access to the currently active fish controllers.
        /// Used by the food system to send notifications without expensive scene searches.
        /// </summary>
        public static IReadOnlyList<FishController> ActiveFishControllers => ActiveFish;

        private void Awake()
        {
            _body = GetComponent<Rigidbody>();
            _body.useGravity = false;
            _body.drag = 4f;
            _body.angularDrag = 4f;
            _body.constraints = RigidbodyConstraints.FreezeRotationX | RigidbodyConstraints.FreezeRotationZ;
            CacheAnimatorHashes();
        }

        private void OnEnable()
        {
            if (!ActiveFish.Contains(this))
            {
                ActiveFish.Add(this);
            }
        }

        private void OnDisable()
        {
            ActiveFish.Remove(this);
        }

        private void Start()
        {
            _wanderTarget = transform.position + transform.forward;
            PickNewWanderTarget();
            _lastBobSample = 0f;
        }

        private void OnValidate()
        {
            CacheAnimatorHashes();
        }

        private void Update()
        {
            UpdateAnimator();
        }

        private void FixedUpdate()
        {
            UpdateFoodTarget();
            Vector3 desiredDirection = _currentFood != null ?
                (_currentFood.transform.position - transform.position).normalized :
                GetWanderDirection();

            RotateTowards(desiredDirection);
            Vector3 forwardVelocity = transform.forward * swimSpeed;

            if (_currentFood != null)
            {
                // Slight speed boost when pursuing food.
                forwardVelocity *= pursuitAcceleration;

                float sqrDistance = (transform.position - _currentFood.transform.position).sqrMagnitude;
                if (sqrDistance <= foodConsumeDistance * foodConsumeDistance)
                {
                    _currentFood.Consume();
                    _currentFood = null;
                }
            }

            ApplyVerticalBob();
            _body.velocity = new Vector3(forwardVelocity.x, _bobOffset.y, forwardVelocity.z);
        }

        private void UpdateAnimator()
        {
            if (animator == null)
            {
                return;
            }

            float speed = _body.velocity.magnitude;
            if (!string.IsNullOrEmpty(swimSpeedParameter))
            {
                animator.SetFloat(_swimSpeedHash, speed);
            }
        }

        private Vector3 GetWanderDirection()
        {
            _recenterTimer += Time.fixedDeltaTime;
            if (_recenterTimer >= wanderRecenterTime || Vector3.Distance(transform.position, _wanderTarget) < 0.3f)
            {
                PickNewWanderTarget();
            }

            Vector3 toTarget = _wanderTarget - transform.position;
            if (toTarget.sqrMagnitude < 0.01f)
            {
                PickNewWanderTarget();
                toTarget = _wanderTarget - transform.position;
            }

            return toTarget.normalized;
        }

        private void PickNewWanderTarget()
        {
            _recenterTimer = 0f;
            Vector3 basePoint;
            if (AquariumManager.Instance != null)
            {
                basePoint = AquariumManager.Instance.GetRandomPointInBounds();
            }
            else
            {
                basePoint = transform.position + Random.insideUnitSphere * wanderRadius;
            }

            _wanderTarget = basePoint + Random.insideUnitSphere * wanderJitter;
            _wanderTarget.y = Mathf.Clamp(_wanderTarget.y, transform.position.y - wanderRadius, transform.position.y + wanderRadius);
        }

        private void UpdateFoodTarget()
        {
            if (AquariumManager.Instance == null)
            {
                return;
            }

            if (_currentFood != null && !_currentFood.gameObject.activeInHierarchy)
            {
                _currentFood = null;
            }

            if (_currentFood != null)
            {
                // Keep chasing current food.
                return;
            }

            float closestDist = float.MaxValue;
            FoodController closest = null;
            foreach (FoodController food in AquariumManager.Instance.ActiveFood)
            {
                if (food == null || !food.gameObject.activeInHierarchy)
                {
                    continue;
                }

                float sqrDist = (food.transform.position - transform.position).sqrMagnitude;
                if (sqrDist <= foodDetectionRadius * foodDetectionRadius && sqrDist < closestDist)
                {
                    closestDist = sqrDist;
                    closest = food;
                }
            }

            if (closest != null)
            {
                _currentFood = closest;
                if (_foodLostRoutine != null)
                {
                    StopCoroutine(_foodLostRoutine);
                    _foodLostRoutine = null;
                }
            }
        }

        private void RotateTowards(Vector3 direction)
        {
            if (direction.sqrMagnitude < Mathf.Epsilon)
            {
                return;
            }

            Quaternion targetRotation = Quaternion.LookRotation(direction, Vector3.up);
            Quaternion smoothed = Quaternion.RotateTowards(transform.rotation, targetRotation, turnSpeed * Time.fixedDeltaTime);
            _body.MoveRotation(smoothed);
        }

        private void ApplyVerticalBob()
        {
            if (bobAmplitude <= Mathf.Epsilon || bobSpeed <= Mathf.Epsilon)
            {
                _bobOffset = Vector3.zero;
                return;
            }

            _bobTime += bobSpeed * Time.fixedDeltaTime;
            if (_bobTime > Mathf.PI * 2f)
            {
                _bobTime -= Mathf.PI * 2f;
            }

            float currentSample = Mathf.Sin(_bobTime) * bobAmplitude;
            float velocityY = (currentSample - _lastBobSample) / Time.fixedDeltaTime;
            _lastBobSample = currentSample;
            _bobOffset = new Vector3(0f, velocityY, 0f);
        }

        /// <summary>
        /// Public API to force the fish back to wandering (e.g., when food disappears).
        /// </summary>
        public void NotifyFoodGone(FoodController food)
        {
            if (_currentFood == food)
            {
                if (_foodLostRoutine != null)
                {
                    StopCoroutine(_foodLostRoutine);
                }
                _foodLostRoutine = StartCoroutine(ResumeWanderWithDelay());
            }
        }

        private IEnumerator ResumeWanderWithDelay()
        {
            yield return new WaitForSeconds(Random.Range(0.5f, 1.5f));
            _currentFood = null;
            PickNewWanderTarget();
            _foodLostRoutine = null;
        }

        private void CacheAnimatorHashes()
        {
            _swimSpeedHash = string.IsNullOrEmpty(swimSpeedParameter)
                ? Animator.StringToHash("SwimSpeed")
                : Animator.StringToHash(swimSpeedParameter);
        }
    }
}
